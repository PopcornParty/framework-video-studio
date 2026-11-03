#!/usr/bin/env node
/**
 * Extract and validate FRAMEWORK DNA v1 from:
 * - a compact FW1: gzip+Base64URL code (prefix is case-insensitive)
 * - a wrapped FRAMEWORK DNA block
 * - raw JSON
 *
 * Used by the GitHub Actions render workflow. No network. No ffmpeg.
 *
 * Reads raw DNA from the DNA environment variable.
 * On success writes cleaned JSON to job/dna.json.
 * On failure writes a report and exits 1.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { planJob } from './render-plan.mjs'

export const COMPACT_PREFIX = 'FW1:'
const COMPACT_PREFIX_RE = /^fw1:/i

export function extractJson(raw) {
  if (typeof raw !== 'string') return ''
  const start = raw.indexOf('---FRAMEWORK DNA')
  const end = raw.indexOf('---END FRAMEWORK DNA---')
  if (start !== -1 && end !== -1 && end > start) {
    const headerEnd = raw.indexOf('---', start + 3)
    const jsonStart = raw.indexOf('\n', headerEnd)
    if (jsonStart !== -1 && jsonStart < end) return raw.slice(jsonStart, end).trim()
  }
  return raw.trim()
}

/** Encode text (raw JSON or a wrapped DNA block) as a single-line FW1: code. */
export function encodeCompact(text) {
  if (typeof text !== 'string' || !text) {
    throw new Error('Nothing to encode.')
  }
  const compressed = gzipSync(Buffer.from(text, 'utf8'))
  return COMPACT_PREFIX + compressed.toString('base64url')
}

export function isCompactDna(raw) {
  return typeof raw === 'string' && COMPACT_PREFIX_RE.test(raw.trim())
}

/** Normalize fw1:/FW1:/Fw1: to the canonical FW1: prefix. */
export function normalizeCompactPrefix(raw) {
  const trimmed = String(raw || '').trim()
  if (!COMPACT_PREFIX_RE.test(trimmed)) return trimmed
  return COMPACT_PREFIX + trimmed.slice(COMPACT_PREFIX.length)
}

/** Diagnostics about the received input. Does not include the DNA body. */
export function describeInput(raw) {
  const text = typeof raw === 'string' ? raw : ''
  const trimmed = text.trim()
  return {
    startsWithFw1: trimmed.startsWith(COMPACT_PREFIX),
    startsWithFw1IgnoreCase: COMPACT_PREFIX_RE.test(trimmed),
    characterCount: text.length,
    hasBackticks: text.includes('`'),
    hasQuotationMarks: text.includes('"') || text.includes("'"),
  }
}

export function formatInputDiagnostics(raw) {
  const d = describeInput(raw)
  return [
    `received starts with FW1:: ${d.startsWithFw1}`,
    `character count: ${d.characterCount}`,
    `contains backticks: ${d.hasBackticks}`,
    `contains quotation marks: ${d.hasQuotationMarks}`,
  ]
}

function preview(text, limit = 100) {
  const value = String(text || '')
  const slice = value.slice(0, limit).replace(/\r?\n/g, '\\n')
  return value.length > limit ? `${slice}…` : slice
}

/** Decode an FW1: code to the original text. Throws on corruption. */
export function decodeCompact(raw) {
  if (typeof raw !== 'string') {
    throw new Error('Compact DNA code is invalid.')
  }
  const trimmed = raw.trim()
  if (!COMPACT_PREFIX_RE.test(trimmed)) {
    throw new Error('Compact DNA code must start with FW1:.')
  }
  const payload = trimmed.slice(COMPACT_PREFIX.length).trim()
  if (!payload) {
    throw new Error('Compact DNA code is empty.')
  }

  let compressed
  try {
    compressed = Buffer.from(payload, 'base64url')
  } catch {
    throw new Error('Compact DNA code is not valid Base64URL.')
  }
  if (!compressed.length) {
    throw new Error('Compact DNA code is empty after decoding.')
  }

  let inflated
  try {
    inflated = gunzipSync(compressed)
  } catch {
    throw new Error('Compact DNA code could not be decompressed.')
  }

  const text = inflated.toString('utf8')
  if (!text.trim()) {
    throw new Error('Compact DNA decoded to empty content.')
  }
  return text
}

export function validateDna(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, errors: ['DNA is empty.', ...formatInputDiagnostics(raw)] }
  }

  let text = raw.trim()
  let decodedFromCompact = false
  if (isCompactDna(text)) {
    try {
      text = decodeCompact(normalizeCompactPrefix(text))
      decodedFromCompact = true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Compact DNA code is invalid.'
      return {
        ok: false,
        errors: [
          'Compact DNA decoding failed.',
          message,
          ...formatInputDiagnostics(raw),
        ],
      }
    }
  }

  const jsonText = extractJson(text)
  if (!jsonText) {
    return { ok: false, errors: ['No DNA content found.', ...formatInputDiagnostics(raw)] }
  }

  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    if (decodedFromCompact) {
      return {
        ok: false,
        errors: [
          'Compact DNA decoded, but the result is not valid JSON.',
          `decoded preview: ${preview(text, 100)}`,
          ...formatInputDiagnostics(raw),
        ],
      }
    }
    return {
      ok: false,
      errors: [
        'Raw DNA is not valid JSON.',
        ...formatInputDiagnostics(raw),
      ],
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      errors: ['DNA must be a JSON object.', ...formatInputDiagnostics(raw)],
    }
  }

  const errors = []
  if (parsed.schema !== 'framework-dna') {
    errors.push('schema must be "framework-dna".')
  }
  if (parsed.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1.')
  }
  if (errors.length) return { ok: false, errors }

  // Same plan check as before. Compact input does not skip provenance or asset rules.
  const plan = planJob(parsed, [])
  if (!plan.ok) {
    return { ok: false, errors: plan.errors }
  }

  return { ok: true, dna: parsed, errors: [] }
}

function fail(message) {
  mkdirSync('render-out', { recursive: true })
  writeFileSync('render-out/report.txt', `FAILED\n${message}\n`)
  console.error(message)
  process.exit(1)
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith('validate-dna.mjs') ||
  process.argv[1].endsWith('validate-dna.js')
)

if (isMain) {
  const raw = process.env.DNA || ''
  if (!raw.trim()) fail(['DNA input is required.', ...formatInputDiagnostics(raw)].join('\n'))

  const result = validateDna(raw)
  if (!result.ok) fail(result.errors.join('\n'))

  mkdirSync('job', { recursive: true })
  writeFileSync('job/dna.json', JSON.stringify(result.dna, null, 2))
  console.log('DNA validated:', result.dna.schema, 'v' + result.dna.schemaVersion)
  console.log('Shots planned:', (result.dna.visuals || []).length)
}
