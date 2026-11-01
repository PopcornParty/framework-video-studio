import { describe, it, expect } from 'vitest'
import { recommendStructure, recommendHook, getStructure } from './select'
import { checkSufficientInformation } from './check'
import { STRUCTURES, HOOKS, STORYTELLING_VERSION } from './knowledge'
import type { Fact } from '../research'

function fact(id: string, status: Fact['verificationStatus'], approved = true): Fact {
  return {
    id,
    statement: 'A test fact statement here.',
    sourceId: 'SRC-0001',
    verificationStatus: status,
    approvedForScript: approved,
    conflictsWith: [],
  }
}

describe('structure selection', () => {
  it('recommends montage for a cinematic supercar prompt', () => {
    const r = recommendStructure({
      prompt: 'Create a cinematic video about supercars at night',
      approvedFacts: [],
      requestedDurationSec: 30,
    })
    expect(r.recommendedStructureId).toBe('montage')
  })

  it('recommends explanatory when prompt asks to explain and facts exist', () => {
    const r = recommendStructure({
      prompt: 'Explain how electric motors work',
      approvedFacts: [fact('F1', 'verified')],
      requestedDurationSec: 40,
    })
    expect(['explanatory', 'qa']).toContain(r.recommendedStructureId)
  })

  it('user override is independent of recommendation', () => {
    const rec = recommendStructure({
      prompt: 'cinematic night driving',
      approvedFacts: [],
      requestedDurationSec: 30,
    })
    const overridden = 'list'
    expect(overridden).not.toBe(rec.recommendedStructureId)
    expect(getStructure(overridden)?.name).toBe('List / tips')
  })
})

describe('hooks', () => {
  it('selects a hook suitable for the structure', () => {
    const hook = recommendHook('montage', false)
    expect(hook.bestWith).toContain('montage')
    expect(HOOKS.map(h => h.id)).toContain(hook.id)
  })

  it('does not require a verified fact for visual-promise', () => {
    const hook = recommendHook('montage', false)
    expect(hook.requiresVerifiedFact).toBe(false)
  })
})

describe('insufficient information', () => {
  it('flags explanatory structure with no usable facts', () => {
    const r = checkSufficientInformation({
      structureId: 'explanatory',
      approvedFacts: [],
      requestedDurationSec: 30,
      prompt: 'Explain batteries',
    })
    expect(r.ok).toBe(false)
    expect(r.issues.some(i => i.includes('verified or user-stated'))).toBe(true)
  })

  it('flags unrealistic short duration', () => {
    const r = checkSufficientInformation({
      structureId: 'montage',
      approvedFacts: [],
      requestedDurationSec: 5,
      prompt: 'cinematic cars',
    })
    expect(r.issues.some(i => i.includes('under 10'))).toBe(true)
  })

  it('does not invent facts to fill gaps', () => {
    const r = checkSufficientInformation({
      structureId: 'explanatory',
      approvedFacts: [fact('F1', 'assumption')],
      requestedDurationSec: 30,
      prompt: 'Explain something',
    })
    expect(r.issues.length).toBeGreaterThan(0)
    expect(r.issues.join(' ')).not.toMatch(/invented|generated fact/i)
  })
})

describe('preservation', () => {
  it('knowledge base is versioned and structures are complete', () => {
    expect(STORYTELLING_VERSION).toBe(1)
    expect(STRUCTURES.length).toBeGreaterThanOrEqual(7)
    for (const s of STRUCTURES) {
      expect(s.purpose).toBeTruthy()
      expect(s.stages.length).toBeGreaterThan(0)
      expect(s.failsWhen.length).toBeGreaterThan(0)
    }
  })
})
