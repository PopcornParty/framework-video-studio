import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { normalizeTag } from './tags'
import type { Research } from './research'

export interface Asset {
  id: string
  filename: string
  displayName: string
  description: string
  keywords: string[]
  subject: string
  actions: string[]
  environment: string
  shotType: string
  style: string
  orientation: 'landscape' | 'portrait' | 'square' | 'unknown'
  duration: number
  resolution: string
  width: number
  height: number
  source: string
  creator: string
  licence: string
  approved: boolean
  createdAt: number
  thumbnail?: string
  fileBlob?: Blob
}

export interface StoryboardScene {
  sceneNumber: number
  assetId: string
  description: string
  purpose: string
  startTime: number
  duration: number
  endTime: number
  reason: string
  transition: string
  textOverlay?: string
}

export interface TimelineClip {
  id: string
  assetId: string
  trimStart: number
  trimEnd: number
  duration: number
  transition: string
  textOverlay?: string
  volume: number
}

export interface RenderSettings {
  width: number
  height: number
  fps: number
  aspectRatio: '9:16' | '16:9' | '1:1'
  quality: 'high' | 'medium' | 'low'
}

export interface Production {
  id: string
  title: string
  prompt: string
  research?: Research
  interpretedIntent?: {
    subject: string
    duration: number
    platform: string
    style: string
    storyBeats: string[]
  }
  storyboard: StoryboardScene[]
  timeline: TimelineClip[]
  renderSettings: RenderSettings
  status: 'draft' | 'approved' | 'rendered'
  createdAt: number
  updatedAt: number
  outputBlob?: Blob
}

export interface TagRecord {
  name: string
  count: number
  createdAt: number
}

interface FrameworkDB extends DBSchema {
  assets: {
    key: string
    value: Asset
    indexes: { 'by-approved': boolean }
  }
  productions: {
    key: string
    value: Production
  }
  tags: {
    key: string
    value: TagRecord
  }
  counters: {
    key: string
    value: { id: string; value: number }
  }
}

let dbPromise: Promise<IDBPDatabase<FrameworkDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FrameworkDB>('framework-video-studio', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const assetStore = db.createObjectStore('assets', { keyPath: 'id' })
          assetStore.createIndex('by-approved', 'approved')
          db.createObjectStore('productions', { keyPath: 'id' })
          db.createObjectStore('counters', { keyPath: 'id' })
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('tags')) {
            db.createObjectStore('tags', { keyPath: 'name' })
          }
        }
      },
    })
  }
  return dbPromise
}

export async function getNextAssetId(): Promise<string> {
  const db = await getDB()
  const tx = db.transaction('counters', 'readwrite')
  const store = tx.objectStore('counters')
  const current = await store.get('asset')
  const next = (current?.value || 0) + 1
  await store.put({ id: 'asset', value: next })
  await tx.done
  return `AST-${String(next).padStart(6, '0')}`
}

export async function getNextProductionId(): Promise<string> {
  const db = await getDB()
  const tx = db.transaction('counters', 'readwrite')
  const store = tx.objectStore('counters')
  const current = await store.get('production')
  const next = (current?.value || 0) + 1
  await store.put({ id: 'production', value: next })
  await tx.done
  return `PRD-${String(next).padStart(6, '0')}`
}

export async function saveAsset(asset: Asset): Promise<void> {
  const db = await getDB()
  await db.put('assets', asset)
  for (const kw of asset.keywords) {
    await upsertTag(kw)
  }
}

export async function getAllAssets(): Promise<Asset[]> {
  const db = await getDB()
  return db.getAll('assets')
}

export async function getApprovedAssets(): Promise<Asset[]> {
  const db = await getDB()
  return db.getAllFromIndex('assets', 'by-approved', true)
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('assets', id)
}

export async function updateAsset(id: string, updates: Partial<Asset>): Promise<void> {
  const db = await getDB()
  const existing = await db.get('assets', id)
  if (existing) {
    const updated = { ...existing, ...updates }
    await db.put('assets', updated)
    if (updates.keywords) {
      for (const kw of updates.keywords) await upsertTag(kw)
    }
  }
}

export async function bulkDeleteAssets(ids: string[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('assets', 'readwrite')
  for (const id of ids) {
    await tx.store.delete(id)
  }
  await tx.done
}

export async function bulkUpdateAssets(ids: string[], updates: Partial<Asset>): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('assets', 'readwrite')
  for (const id of ids) {
    const existing = await tx.store.get(id)
    if (existing) {
      await tx.store.put({ ...existing, ...updates })
    }
  }
  await tx.done
}

export async function upsertTag(name: string): Promise<void> {
  const tag = normalizeTag(name)
  if (!tag) return
  const db = await getDB()
  const existing = await db.get('tags', tag)
  if (existing) {
    await db.put('tags', { ...existing, count: existing.count + 1 })
  } else {
    await db.put('tags', { name: tag, count: 1, createdAt: Date.now() })
  }
}

export async function getAllTags(): Promise<TagRecord[]> {
  const db = await getDB()
  return db.getAll('tags')
}

export async function renameTag(oldName: string, newName: string): Promise<void> {
  const oldN = normalizeTag(oldName)
  const newN = normalizeTag(newName)
  if (!oldN || !newN || oldN === newN) return
  const db = await getDB()
  const assets = await db.getAll('assets')
  for (const asset of assets) {
    if (asset.keywords.includes(oldN)) {
      const keywords = asset.keywords.map(k => (k === oldN ? newN : k))
      await db.put('assets', { ...asset, keywords })
    }
  }
  const oldTag = await db.get('tags', oldN)
  if (oldTag) {
    await db.delete('tags', oldN)
    await upsertTag(newN)
  }
}

export async function saveProduction(prod: Production): Promise<void> {
  const db = await getDB()
  await db.put('productions', { ...prod, updatedAt: Date.now() })
}

export async function getAllProductions(): Promise<Production[]> {
  const db = await getDB()
  return db.getAll('productions')
}

export async function getProduction(id: string): Promise<Production | undefined> {
  const db = await getDB()
  return db.get('productions', id)
}

export async function deleteProduction(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('productions', id)
}

export interface ExportData {
  version: 1
  exportedAt: number
  assets: Omit<Asset, 'fileBlob'>[]
  productions: Omit<Production, 'outputBlob'>[]
  tags: TagRecord[]
}

export async function exportProject(): Promise<ExportData> {
  const [assets, productions, tags] = await Promise.all([
    getAllAssets(),
    getAllProductions(),
    getAllTags(),
  ])
  return {
    version: 1,
    exportedAt: Date.now(),
    assets: assets.map(({ fileBlob, ...rest }) => rest),
    productions: productions.map(({ outputBlob, ...rest }) => rest),
    tags,
  }
}

export async function importProject(data: ExportData): Promise<void> {
  if (data.version !== 1) throw new Error('Unsupported export version')
  const db = await getDB()
  const tx = db.transaction(['assets', 'productions', 'tags'], 'readwrite')
  for (const asset of data.assets) {
    await tx.objectStore('assets').put(asset as Asset)
  }
  for (const prod of data.productions) {
    await tx.objectStore('productions').put(prod as Production)
  }
  for (const tag of data.tags) {
    await tx.objectStore('tags').put(tag)
  }
  await tx.done
}
