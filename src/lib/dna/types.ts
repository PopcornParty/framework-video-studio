/** DNA v1 types. Data only. Not executable. */

export const DNA_SCHEMA = 'framework-dna'
export const DNA_VERSION = 1
export const MAX_DNA_BYTES = 2_000_000
export const MAX_DEPTH = 12

export type VerificationStatus = 'verified' | 'user-stated' | 'unverified' | 'assumption'
export type Origin = 'user' | 'chatgpt-research' | 'imported-document'
export type SupportLevel =
  | 'source-found'
  | 'excerpt-captured'
  | 'excerpt-supports-claim'
  | 'excerpt-partial'
  | 'disputed'
  | 'uncertain'
export type Independence = 'single-source' | 'same-origin-repeat' | 'independent-corroboration'
export type ClaimKind = 'factual' | 'creative' | 'opinion'
export type AssetOrigin = 'external' | 'user-provided'

export interface DnaSource {
  id: string
  label: string
  url?: string
  publishedAt?: string
  excerpt?: string
}

export interface DnaFact {
  id: string
  statement: string
  origin: Origin
  sourceIds: string[]
  excerpt?: string
  supportLevel: SupportLevel
  independence: Independence
  verificationStatus: VerificationStatus
  approvedForScript: boolean
  conflictsWith?: string[]
  uncertainty?: string | null
  userOverride?: { reason: string; at?: string } | null
}

export interface DnaClaim {
  id: string
  text: string
  kind: ClaimKind
  factIds: string[]
}

export interface DnaVisual {
  id: string
  origin: AssetOrigin
  depicts: string
  required?: boolean
  originalFilename?: string
  fileSize?: number
  mediaType?: string
  durationSec?: number
  inspected?: boolean
  obtain?: {
    method?: string
    url?: string
    licence?: string
    commercialUse?: 'yes' | 'no' | 'unknown'
    attribution?: string
  }
}

export interface DnaPackage {
  schema: string
  schemaVersion: number
  request: {
    original: string
    durationSec?: number
    format?: string
    platform?: string
  }
  research: {
    subject: string
    sources: DnaSource[]
    facts: DnaFact[]
    gaps?: string[]
  }
  storytelling?: {
    structureId?: string
    hookId?: string
    reason?: string
  }
  script?: {
    lines?: { id: string; text: string; claims?: DnaClaim[] }[]
  }
  claims?: DnaClaim[]
  scenes?: unknown[]
  visuals?: DnaVisual[]
  [key: string]: unknown
}

export interface DecodeSuccess {
  ok: true
  dna: DnaPackage
  fingerprint: string
  warnings: string[]
}

export interface DecodeFailure {
  ok: false
  errors: string[]
}

export type DecodeResult = DecodeSuccess | DecodeFailure
