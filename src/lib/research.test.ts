import { describe, it, expect, beforeEach } from 'vitest'
import {
  createSource,
  extractCandidateFacts,
  detectConflicts,
  setApprovedForScript,
  setVerificationStatus,
  approvedFacts,
  scriptTreatment,
  allowedScriptUse,
  resetIdCounter,
  Fact,
} from './research'

beforeEach(() => {
  resetIdCounter(1)
})

describe('research intake', () => {
  it('creates two distinct sources from two pastes', () => {
    const s1 = createSource('Wiki', 'The car has a top speed of 200 mph.')
    const s2 = createSource('Article', 'The car has a top speed of 180 mph.')
    expect(s1.id).not.toBe(s2.id)
    expect(s2.rawText).toContain('180')
  })

  it('extracts candidate facts linked to source, unverified and not approved', () => {
    const src = createSource('Test', 'Supercars can exceed 200 miles per hour. They require special tyres for high speed.')
    const facts = extractCandidateFacts(src.rawText, src.id)
    expect(facts[0].sourceId).toBe(src.id)
    expect(facts[0].verificationStatus).toBe('unverified')
    expect(facts[0].approvedForScript).toBe(false)
  })

  it('detects numeric conflicts between different sources on the same topic', () => {
    const s1 = createSource('A', 'placeholder')
    const s2 = createSource('B', 'placeholder')
    const f1 = extractCandidateFacts('The supercar reaches 200 miles per hour on the track.', s1.id)
    const f2 = extractCandidateFacts('The supercar reaches 180 miles per hour on the track.', s2.id)
    const withConflicts = detectConflicts([...f1, ...f2])
    expect(withConflicts.filter(f => f.conflictsWith.length > 0)).toHaveLength(2)
  })

  it('approval and verification are independent', () => {
    const src = createSource('S', 'x')
    let facts = extractCandidateFacts('Electric vehicles produce zero tailpipe emissions during operation.', src.id)
    facts = setApprovedForScript(facts, facts[0].id, true)
    expect(facts[0].approvedForScript).toBe(true)
    expect(facts[0].verificationStatus).toBe('unverified')
    facts = setVerificationStatus(facts, facts[0].id, 'verified')
    expect(facts[0].approvedForScript).toBe(true)
    expect(facts[0].verificationStatus).toBe('verified')
    facts = setApprovedForScript(facts, facts[0].id, false)
    expect(facts[0].approvedForScript).toBe(false)
    expect(facts[0].verificationStatus).toBe('verified')
  })

  it('script treatment follows verification and is not upgraded by approval', () => {
    const base: Fact = {
      id: 'FCT-0001',
      statement: 'Test claim here for the rule.',
      sourceId: 'SRC-0001',
      verificationStatus: 'assumption',
      approvedForScript: true,
      conflictsWith: [],
    }
    expect(scriptTreatment('verified')).toBe('established-fact')
    expect(scriptTreatment('user-stated')).toBe('attributed')
    expect(scriptTreatment('unverified')).toBe('qualified-or-exclude')
    expect(scriptTreatment('assumption')).toBe('never-as-fact')
    expect(allowedScriptUse(base)).toBe('never-as-fact')
    expect(allowedScriptUse({ ...base, approvedForScript: false })).toBeNull()
    expect(allowedScriptUse({ ...base, verificationStatus: 'verified', approvedForScript: true })).toBe('established-fact')
  })

  it('research object preserves source text, fact IDs, approval, verification, conflicts', () => {
    const src = createSource('Export test', 'A claim about battery range exists here for testing purposes.')
    let facts = extractCandidateFacts(src.rawText, src.id)
    facts = setApprovedForScript(facts, facts[0].id, true)
    facts = setVerificationStatus(facts, facts[0].id, 'user-stated')
    const research = {
      subject: 'EV',
      sources: [src],
      facts,
      gaps: [],
      lastUpdated: Date.now(),
    }
    expect(research.sources[0].rawText).toContain('battery')
    expect(research.facts[0].id).toMatch(/^FCT-/)
    expect(research.facts[0].approvedForScript).toBe(true)
    expect(research.facts[0].verificationStatus).toBe('user-stated')
    expect(approvedFacts(research.facts)).toHaveLength(1)
  })
})
