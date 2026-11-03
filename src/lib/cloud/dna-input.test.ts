import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import {
  extractJson,
  validateDna,
  encodeCompact,
  decodeCompact,
  COMPACT_PREFIX,
  formatInputDiagnostics,
} from '../../../scripts/validate-dna.mjs'

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

  it('accepts a lowercase fw1: compact code', () => {
    const code = 'fw1:' + encodeCompact(JSON.stringify(validBase)).slice(COMPACT_PREFIX.length)
    const r = validateDna(code)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.dna.schemaVersion).toBe(1)
  })

  it('rejects a corrupted compact code', () => {
    const corrupted = COMPACT_PREFIX + Buffer.from('this is not gzip data').toString('base64url')
    const r = validateDna(corrupted)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.some(e => e.includes('Compact DNA decoding failed.'))).toBe(true)
      expect(r.errors.some(e => e.toLowerCase().includes('decompressed') || e.toLowerCase().includes('invalid'))).toBe(true)
    }
  })

  it('rejects compact DNA that decodes to invalid JSON', () => {
    const decoded = '{not valid json'
    const code = COMPACT_PREFIX + gzipSync(Buffer.from(decoded, 'utf8')).toString('base64url')
    expect(decodeCompact(code)).toBe(decoded)
    const r = validateDna(code)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.some(e => e.includes('Compact DNA decoded, but the result is not valid JSON.'))).toBe(true)
      expect(r.errors.some(e => e.includes('decoded preview: {not valid json'))).toBe(true)
      expect(r.errors.join('\n')).not.toContain(code)
    }
  })

  it('limits the decoded preview to 100 characters', () => {
    const decoded = '{' + 'x'.repeat(180)
    const code = COMPACT_PREFIX + gzipSync(Buffer.from(decoded, 'utf8')).toString('base64url')
    const r = validateDna(code)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      const preview = r.errors.find(e => e.startsWith('decoded preview: '))
      expect(preview).toBeTruthy()
      expect(preview!.slice('decoded preview: '.length).length).toBeLessThanOrEqual(101)
      expect(preview).toContain('…')
    }
  })

  it('reports input diagnostics for a raw JSON failure', () => {
    const raw = '`{not json}"'
    const r = validateDna(raw)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.some(e => e.includes('Raw DNA is not valid JSON.'))).toBe(true)
      expect(r.errors.some(e => e === 'received starts with FW1:: false')).toBe(true)
      expect(r.errors.some(e => e === `character count: ${raw.length}`)).toBe(true)
      expect(r.errors.some(e => e === 'contains backticks: true')).toBe(true)
      expect(r.errors.some(e => e === 'contains quotation marks: true')).toBe(true)
    }
  })

  it('reports input diagnostics for a compact decoding failure', () => {
    const corrupted = 'FW1:' + Buffer.from('this is not gzip data').toString('base64url')
    const r = validateDna(corrupted)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.some(e => e === 'received starts with FW1:: true')).toBe(true)
      expect(r.errors.some(e => e === `character count: ${corrupted.length}`)).toBe(true)
      expect(r.errors.some(e => e === 'contains backticks: false')).toBe(true)
      expect(r.errors.some(e => e === 'contains quotation marks: false')).toBe(true)
    }
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

  it('formats diagnostics without including the DNA body', () => {
    const lines = formatInputDiagnostics('FW1:abc`def"ghi')
    expect(lines).toEqual([
      'received starts with FW1:: true',
      'character count: 15',
      'contains backticks: true',
      'contains quotation marks: true',
    ])
    expect(lines.join('\n')).not.toContain('abc')
  })
})
