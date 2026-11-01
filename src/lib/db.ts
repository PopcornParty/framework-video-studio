import { openDB, DBSchema, IDBPDatabase } from 'idb'

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
  orientation: string
  duration: number
  resolution: string
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
  startTime: number
  duration: number
  endTime: number
  reason: string
  transition: string
  textOverlay?: string
}

export interface Production {
  id: string
  title: string
  prompt: string
  status: 'draft' | 'approved' | 'rendered'
  storyboard: StoryboardScene[]
  createdAt: number
  updatedAt: number
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
  counters: {
    key: string
    value: { id: string; value: number }
  }
}

let dbPromise: Promise<IDBPDatabase<FrameworkDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FrameworkDB>('framework-video-studio', 1, {
      upgrade(db) {
        const assetStore = db.createObjectStore('assets', { keyPath: 'id' })
        assetStore.createIndex('by-approved', 'approved')
        db.createObjectStore('productions', { keyPath: 'id' })
        db.createObjectStore('counters', { keyPath: 'id' })
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

export async function getAllAssets(): Promise<Asset[]> {
  const db = await getDB()
  return db.getAll('assets')
}

export async function getApprovedAssets(): Promise<Asset[]> {
  const db = await getDB()
  return db.getAllFromIndex('assets', 'by-approved', true)
}
