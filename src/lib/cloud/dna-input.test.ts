import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { extractJson, validateDna, encodeCompact, decodeCompact, COMPACT_PREFIX } from '../../../scripts/validate-dna.mjs'

function wrap(obj: unknown): string {
  return `---FRAMEWORK DNA v1---\n${JSON.stringify(obj)}\n---END FRAMEWORK DNA---`
}

const validBase = {
  schema: 'framework-dna',
  schemaVersion: 1,
  request: { original: 'Test' },
  research: { subject: 'Test', sources: [], facts: [] },
  visuals: [{
    id: 'VIS-1',
    origin: 'external',
    depicts: 'test image',
    obtain: {
      url: 'https://raw.githubusercontent.com/github/explore/main/topics/github/github.png',
      licence: 'example',
      commercialUse: 'yes',
    },
  }],
}

describe('DNA validation for GitHub Actions', () => {
  it('accepts wrapped FRAMEWORK DNA', () => {
    const r = validateDna(wrap(validBase))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.dna.schema).toBe('framework-dna')
  })

  it('accepts raw JSON', () => {
    const r = validateDna(JSON.stringify(validBase))
    expect(r.ok).toBe(true)
  })

  it('rejects missing DNA', () => {
    const r = validateDna('')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some(e => e.toLowerCase().includes('empty'))).toBe(true)
  })

  it('rejects malformed JSON', () => {
    const r = validateDna('---FRAMEWORK DNA v1---\n{not json}\n---END FRAMEWORK DNA---')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some(e => e.includes('valid JSON'))).toBe(true)
  })

  it('rejects incorrect schema', () => {
    const bad = { ...validBase, schema: 'wrong-schema' }
    const r = validateDna(JSON.stringify(bad))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some(e => e.includes('schema'))).toBe(true)
  })

  it('rejects incorrect schemaVersion', () => {
    const bad = { ...validBase, schemaVersion: 2 }
    const r = validateDna(JSON.stringify(bad))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some(e => e.includes('schemaVersion'))).toBe(true)
  })

  it('extracts JSON from wrapper markers', () => {
    const text = extractJson(wrap(validBase))
    expect(text.startsWith('{')).toBe(true)
    expect(JSON.parse(text).schema).toBe('framework-dna')
  })

  it('accepts a valid compact FW1: code of raw JSON', () => {
    const code = encodeCompact(JSON.stringify(validBase))
    expect(code.startsWith(COMPACT_PREFIX)).toBe(true)
    expect(code.includes('\n')).toBe(false)
    const r = validateDna(code)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.dna.schema).toBe('framework-dna')
      expect(r.dna.schemaVersion).toBe(1)
      expect(r.dna.visuals?.[0]?.id).toBe('VIS-1')
    }
  })

  it('accepts a valid compact FW1: code of a wrapped DNA block', () => {
    const code = encodeCompact(wrap(validBase))
    const r = validateDna(code)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.dna.request?.original).toBe('Test')
  })

  it('rejects a corrupted compact code', () => {
    const corrupted = COMPACT_PREFIX + Buffer.from('this is not gzip data').toString('base64url')
    const r = validateDna(corrupted)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some(e => e.toLowerCase().includes('decompressed') || e.toLowerCase().includes('invalid'))).toBe(true)
  })

  it('rejects compact DNA that decodes to invalid JSON', () => {
    const code = COMPACT_PREFIX + gzipSync(Buffer.from('{not valid json', 'utf8')).toString('base64url')
    expect(decodeCompact(code)).toBe('{not valid json')
    const r = validateDna(code)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some(e => e.includes('valid JSON'))).toBe(true)
  })

  it('still rejects bad schema after a successful compact decode', () => {
    const bad = { ...validBase, schema: 'not-framework' }
    const r = validateDna(encodeCompact(JSON.stringify(bad)))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some(e => e.includes('schema'))).toBe(true)
  })

  it('keeps backwards compatibility for existing raw JSON and wrapped blocks', () => {
    expect(validateDna(JSON.stringify(validBase)).ok).toBe(true)
    expect(validateDna(wrap(validBase)).ok).toBe(true)
    expect(validateDna(JSON.stringify({ ...validBase, schemaVersion: 99 })).ok).toBe(false)
  })
})
