import { describe, it, expect } from 'vitest'
import { extractJson, validateDna } from '../../../scripts/validate-dna.mjs'

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
})
