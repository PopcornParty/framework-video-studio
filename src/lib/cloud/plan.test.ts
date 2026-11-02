import { describe, it, expect } from 'vitest'
import { planJob } from '../../../scripts/render-plan.mjs'

const base = {
  schema: 'framework-dna',
  schemaVersion: 1,
  visuals: [{
    id: 'VIS-1',
    origin: 'external',
    depicts: 'tower',
    obtain: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/200px-Tour_Eiffel_Wikimedia_Commons.jpg',
      licence: 'CC BY-SA',
      commercialUse: 'yes',
    },
  }],
}

describe('planJob', () => {
  it('accepts a licensed external visual', () => {
    const r = planJob(base)
    expect(r.ok).toBe(true)
    expect(r.shots[0].kind).toBe('url')
  })

  it('refuses missing required user media', () => {
    const dna = {
      ...base,
      visuals: [{ id: 'USR-1', origin: 'user-provided', originalFilename: 'clip.mov', required: true, depicts: 'road' }],
    }
    const r = planJob(dna, [])
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('USR-1')
  })

  it('accepts user media only when the file is present', () => {
    const dna = {
      ...base,
      visuals: [{ id: 'USR-1', origin: 'user-provided', originalFilename: 'clip.mov', depicts: 'road' }],
    }
    const r = planJob(dna, ['clip.mov'])
    expect(r.ok).toBe(true)
    expect(r.shots[0].kind).toBe('file')
  })

  it('refuses to invent footage when there are no visuals', () => {
    const r = planJob({ ...base, visuals: [] })
    expect(r.ok).toBe(false)
  })

  it('refuses external visual without a licence', () => {
    const dna = {
      ...base,
      visuals: [{ id: 'VIS-1', origin: 'external', depicts: 'x', obtain: { url: 'https://example.com/a.jpg' } }],
    }
    expect(planJob(dna).ok).toBe(false)
  })
})
