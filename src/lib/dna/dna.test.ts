import { describe, it, expect } from 'vitest'
import { decodeDna, extractJson } from './decode'

function wrap(obj: unknown): string {
  return `---FRAMEWORK DNA v1---\n${JSON.stringify(obj)}\n---END FRAMEWORK DNA---`
}

const base = {
  schema: 'framework-dna',
  schemaVersion: 1,
  request: { original: 'Explain the Chiron in 45 seconds.' },
  research: {
    subject: 'Chiron',
    sources: [{ id: 'SRC-1', label: 'Bugatti', excerpt: '8.0-litre W16' }],
    facts: [{
      id: 'FCT-1',
      statement: 'The Chiron has an 8.0-litre W16.',
      origin: 'chatgpt-research',
      sourceIds: ['SRC-1'],
      excerpt: '8.0-litre W16',
      supportLevel: 'excerpt-supports-claim',
      independence: 'single-source',
      verificationStatus: 'unverified',
      approvedForScript: true,
    }],
  },
  claims: [{ id: 'CLM-1', text: '8.0-litre W16', kind: 'factual', factIds: ['FCT-1'] }],
}

describe('decodeDna', () => {
  it('accepts a valid v1 package and returns a fingerprint', async () => {
    const r = await decodeDna(wrap(base))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.fingerprint).toMatch(/^[a-f0-9]{12}$/)
      expect(r.dna.request.original).toContain('Chiron')
    }
  })

  it('rejects empty input', async () => {
    const r = await decodeDna('   ')
    expect(r.ok).toBe(false)
  })

  it('rejects invalid JSON', async () => {
    const r = await decodeDna('---FRAMEWORK DNA v1---\n{nope}\n---END FRAMEWORK DNA---')
    expect(r.ok).toBe(false)
  })

  it('rejects wrong schema version', async () => {
    const r = await decodeDna(wrap({ ...base, schemaVersion: 99 }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some(e => e.includes('schemaVersion'))).toBe(true)
  })

  it('rejects user-stated without user origin', async () => {
    const bad = structuredClone(base)
    bad.research.facts[0].verificationStatus = 'user-stated'
    const r = await decodeDna(wrap(bad))
    expect(r.ok).toBe(false)
  })

  it('rejects verified without corroboration or override', async () => {
    const bad = structuredClone(base)
    bad.research.facts[0].verificationStatus = 'verified'
    const r = await decodeDna(wrap(bad))
    expect(r.ok).toBe(false)
  })

  it('accepts verified with recorded override reason', async () => {
    const ok = structuredClone(base)
    ok.research.facts[0].verificationStatus = 'verified'
    ok.research.facts[0].userOverride = { reason: 'User confirmed against the brochure.' }
    const r = await decodeDna(wrap(ok))
    expect(r.ok).toBe(true)
  })

  it('rejects factual claim with no fact id', async () => {
    const bad = structuredClone(base)
    bad.claims = [{ id: 'CLM-9', text: 'A claim', kind: 'factual', factIds: [] }]
    const r = await decodeDna(wrap(bad))
    expect(r.ok).toBe(false)
  })

  it('rejects external visual without licence', async () => {
    const bad = structuredClone(base) as typeof base & { visuals: unknown[] }
    bad.visuals = [{
      id: 'VIS-1', origin: 'external', depicts: 'car',
      obtain: { url: 'https://upload.wikimedia.org/x.jpg', commercialUse: 'yes' },
    }]
    const r = await decodeDna(wrap(bad))
    expect(r.ok).toBe(false)
  })

  it('rejects uninspected user visual', async () => {
    const bad = structuredClone(base) as typeof base & { visuals: unknown[] }
    bad.visuals = [{
      id: 'USR-1', origin: 'user-provided', depicts: 'road',
      originalFilename: 'clip.mov', inspected: false,
    }]
    const r = await decodeDna(wrap(bad))
    expect(r.ok).toBe(false)
  })

  it('rejects unsafe user filename', async () => {
    const bad = structuredClone(base) as typeof base & { visuals: unknown[] }
    bad.visuals = [{
      id: 'USR-1', origin: 'user-provided', depicts: 'road',
      originalFilename: '../secret.mov', inspected: true,
    }]
    const r = await decodeDna(wrap(bad))
    expect(r.ok).toBe(false)
  })

  it('rejects forbidden keys', async () => {
    const bad = { ...base, __proto__: { admin: true } }
    const r = await decodeDna(JSON.stringify(bad))
    expect(r.ok).toBe(false)
  })

  it('extracts JSON from the DNA block', () => {
    const text = extractJson(wrap(base))
    expect(text.startsWith('{')).toBe(true)
  })
})
