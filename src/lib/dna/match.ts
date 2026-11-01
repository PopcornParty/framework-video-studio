/** Match dropped user files to DNA user-provided visuals. No guessing. No substitution. */

import type { DnaVisual } from './types'

export interface DroppedFile {
  name: string
  size: number
  type: string
  durationSec?: number
  hash: string
  readable: boolean
}

export interface MatchHit {
  assetId: string
  filename: string
  hash: string
  size: number
  type: string
}

export interface MatchResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  matched: MatchHit[]
  ignored: string[]
}

function family(type: string): 'image' | 'video' | 'other' {
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  return 'other'
}

function expectedFamily(mediaType?: string): 'image' | 'video' | 'any' {
  if (!mediaType) return 'any'
  if (mediaType.startsWith('image')) return 'image'
  if (mediaType.startsWith('video')) return 'video'
  return 'any'
}

export function matchUserMedia(visuals: DnaVisual[], files: DroppedFile[]): MatchResult {
  const errors: string[] = []
  const warnings: string[] = []
  const matched: MatchHit[] = []
  const used = new Set<number>()
  const userVisuals = visuals.filter(v => v.origin === 'user-provided')

  for (const v of userVisuals) {
    const name = (v.originalFilename || '').toLowerCase()
    let candidates = files
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f.name.toLowerCase() === name)

    if (typeof v.fileSize === 'number') {
      candidates = candidates.filter(({ f }) => f.size === v.fileSize)
    }
    const want = expectedFamily(v.mediaType)
    if (want !== 'any') {
      candidates = candidates.filter(({ f }) => family(f.type) === want)
    }
    if (typeof v.durationSec === 'number') {
      candidates = candidates.filter(({ f }) =>
        f.durationSec === undefined || Math.abs(f.durationSec - (v.durationSec as number)) <= 0.5,
      )
    }

    if (candidates.length === 0) {
      const msg = `Missing user asset ${v.id} (${v.originalFilename || 'unnamed'}).`
      if (v.required !== false) errors.push(msg)
      else warnings.push(msg)
      continue
    }
    if (candidates.length > 1) {
      errors.push(`Ambiguous match for ${v.id}. ${candidates.length} files could match. Not guessing.`)
      continue
    }

    const { f, i } = candidates[0]
    if (used.has(i)) {
      errors.push(`File ${f.name} would match more than one asset including ${v.id}. Not guessing.`)
      continue
    }
    if (!f.readable) {
      errors.push(`User asset ${v.id} file is not readable.`)
      continue
    }
    if (family(f.type) === 'other') {
      errors.push(`User asset ${v.id} is not a supported image or video (${f.type || 'unknown type'}).`)
      continue
    }
    if (want !== 'any' && family(f.type) !== want) {
      errors.push(`User asset ${v.id} expected ${want} but file is ${f.type}.`)
      continue
    }

    used.add(i)
    matched.push({ assetId: v.id, filename: f.name, hash: f.hash, size: f.size, type: f.type })
  }

  files.forEach((f, i) => {
    if (!used.has(i)) warnings.push(`Ignored unused upload ${f.name}.`)
  })

  return { ok: errors.length === 0, errors, warnings, matched, ignored: files.filter((_, i) => !used.has(i)).map(f => f.name) }
}
