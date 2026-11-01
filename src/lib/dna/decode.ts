/** Pure DNA v1 decoder. Data only. No network. No execution. */

import {
  DNA_SCHEMA,
  DNA_VERSION,
  MAX_DNA_BYTES,
  MAX_DEPTH,
  type DnaPackage,
  type DecodeResult,
  type VerificationStatus,
} from './types'

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const FORBIDDEN_KEY_RE = /"(__proto__|constructor|prototype)"\s*:/

export function extractJson(raw: string): string {
  const start = raw.indexOf('---FRAMEWORK DNA')
  const end = raw.indexOf('---END FRAMEWORK DNA---')
  if (start !== -1 && end !== -1 && end > start) {
    const headerEnd = raw.indexOf('---', start + 3)
    const jsonStart = raw.indexOf('\n', headerEnd)
    if (jsonStart !== -1 && jsonStart < end) return raw.slice(jsonStart, end).trim()
  }
  return raw.trim()
}

function depth(value: unknown, d = 0): number {
  if (d > MAX_DEPTH) return d
  if (value && typeof value === 'object') {
    const vals = Array.isArray(value) ? value : Object.values(value as object)
    return vals.reduce((m, v) => Math.max(m, depth(v, d + 1)), d)
  }
  return d
}

function hasForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  for (const k of Object.keys(value as object)) {
    if (FORBIDDEN_KEYS.has(k)) return true
    if (hasForbiddenKey((value as Record<string, unknown>)[k])) return true
  }
  return false
}

async function sha256Short(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12)
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${stable(obj[k])}`).join(',')}}`
}

export async function decodeDna(raw: string): Promise<DecodeResult> {
  const errors: string[] = []
  const warnings: string[] = []

  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, errors: ['DNA is empty.'] }
  }
  if (new TextEncoder().encode(raw).length > MAX_DNA_BYTES) {
    return { ok: false, errors: [`DNA exceeds ${MAX_DNA_BYTES} bytes.`] }
  }

  const jsonText = extractJson(raw)
  if (FORBIDDEN_KEY_RE.test(jsonText)) {
    return { ok: false, errors: ['DNA contains forbidden keys.'] }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return { ok: false, errors: ['DNA is not valid JSON.'] }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errors: ['DNA must be a JSON object.'] }
  }
  if (hasForbiddenKey(parsed)) {
    return { ok: false, errors: ['DNA contains forbidden keys.'] }
  }
  if (depth(parsed) > MAX_DEPTH) {
    return { ok: false, errors: [`DNA nesting exceeds ${MAX_DEPTH}.`] }
  }

  const dna = parsed as DnaPackage
  if (dna.schema !== DNA_SCHEMA) errors.push('schema must be "framework-dna".')
  if (dna.schemaVersion !== DNA_VERSION) errors.push(`schemaVersion must be ${DNA_VERSION}.`)
  if (!dna.request?.original || typeof dna.request.original !== 'string') {
    errors.push('request.original is required.')
  }
  if (!dna.research?.subject) errors.push('research.subject is required.')
  if (!Array.isArray(dna.research?.sources)) errors.push('research.sources must be an array.')
  if (!Array.isArray(dna.research?.facts)) errors.push('research.facts must be an array.')

  if (errors.length) return { ok: false, errors }

  const sourceIds = new Set<string>()
  for (const s of dna.research.sources) {
    if (!s.id || !s.label) errors.push('Each source needs id and label.')
    else if (sourceIds.has(s.id)) errors.push(`Duplicate source id ${s.id}.`)
    else sourceIds.add(s.id)
  }

  const factIds = new Set<string>()
  for (const f of dna.research.facts) {
    if (!f.id || !f.statement) {
      errors.push('Each fact needs id and statement.')
      continue
    }
    if (factIds.has(f.id)) errors.push(`Duplicate fact id ${f.id}.`)
    factIds.add(f.id)
    if (!Array.isArray(f.sourceIds) || f.sourceIds.length === 0) {
      errors.push(`Fact ${f.id} needs sourceIds.`)
    } else {
      for (const sid of f.sourceIds) {
        if (!sourceIds.has(sid)) errors.push(`Fact ${f.id} references missing source ${sid}.`)
      }
    }
    const status = f.verificationStatus as VerificationStatus
    if (!['verified', 'user-stated', 'unverified', 'assumption'].includes(status)) {
      errors.push(`Fact ${f.id} has invalid verificationStatus.`)
    }
    if (status === 'user-stated' && f.origin !== 'user') {
      errors.push(`Fact ${f.id} is user-stated but origin is not user.`)
    }
    if (status === 'verified') {
      const override = f.userOverride && f.userOverride.reason
      if (f.independence !== 'independent-corroboration' && !override) {
        errors.push(`Fact ${f.id} is verified without independent corroboration or a recorded override.`)
      }
    }
    if (f.userOverride && !f.userOverride.reason) {
      errors.push(`Fact ${f.id} override requires a reason.`)
    }
  }

  const claims = [
    ...(dna.claims || []),
    ...(dna.script?.lines || []).flatMap(l => l.claims || []),
  ]
  const claimIds = new Set<string>()
  for (const c of claims) {
    if (!c.id || !c.kind) {
      errors.push('Each claim needs id and kind.')
      continue
    }
    if (claimIds.has(c.id)) errors.push(`Duplicate claim id ${c.id}.`)
    claimIds.add(c.id)
    if (!['factual', 'creative', 'opinion'].includes(c.kind)) {
      errors.push(`Claim ${c.id} has invalid kind.`)
    }
    if (c.kind === 'factual' && (!c.factIds || c.factIds.length === 0)) {
      errors.push(`Factual claim ${c.id} has no factIds.`)
    }
    for (const fid of c.factIds || []) {
      if (!factIds.has(fid)) errors.push(`Claim ${c.id} references missing fact ${fid}.`)
    }
  }

  const visualIds = new Set<string>()
  for (const v of dna.visuals || []) {
    if (!v.id || !v.origin || !v.depicts) {
      errors.push('Each visual needs id, origin, and depicts.')
      continue
    }
    if (visualIds.has(v.id)) errors.push(`Duplicate visual id ${v.id}.`)
    visualIds.add(v.id)
    if (v.origin !== 'external' && v.origin !== 'user-provided') {
      errors.push(`Visual ${v.id} has invalid origin.`)
    }
    if (v.origin === 'user-provided') {
      if (v.inspected !== true) errors.push(`User visual ${v.id} was not marked inspected.`)
      if (!v.originalFilename) errors.push(`User visual ${v.id} needs originalFilename.`)
      if (v.originalFilename && (v.originalFilename.includes('..') || v.originalFilename.includes('/') || v.originalFilename.includes('\\'))) {
        errors.push(`User visual ${v.id} has an unsafe filename.`)
      }
    }
    if (v.origin === 'external') {
      const lic = v.obtain?.licence
      const commercial = v.obtain?.commercialUse
      if (!lic) errors.push(`External visual ${v.id} needs a licence.`)
      if (!commercial || commercial === 'unknown') {
        errors.push(`External visual ${v.id} needs known commercialUse.`)
      }
      if (!v.obtain?.url) errors.push(`External visual ${v.id} needs a URL.`)
    }
  }

  if (errors.length) return { ok: false, errors }

  if ((dna.visuals || []).some(v => v.origin === 'user-provided')) {
    warnings.push('User-provided media is recorded. Files are not in the DNA. Import matching is a later step.')
  }
  warnings.push('Semantic truth was planned by ChatGPT. This decoder checks references only.')
  warnings.push('No download or render was performed.')

  const fingerprint = await sha256Short(stable(dna))
  return { ok: true, dna, fingerprint, warnings }
}
