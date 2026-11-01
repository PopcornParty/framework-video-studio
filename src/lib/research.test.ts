import { describe, it, expect, beforeEach } from 'vitest'
import {
  createSource,
  extractCandidateFacts,
  detectConflicts,
  setApprovedForScript,
  setVerificationStatus,
  approvedFacts,
  resetIdCounter,
} from './research'

beforeEach(() => {
  resetIdCounter(1)
})

describe('research intake', () => {
  it('creates two distinct sources from two pastes', () => {
    const s1 = createSource('Wiki', 'The car has a top speed of 200 mph.')
    const s2 = createSource('Article', 'The car has a top speed of 180 mph.')
    expect(s1.id).not.toBe(s2.id)
    expect(s1.label).toBe('Wiki')
    expect(s2.rawText).toContain('180')
  })

  it('extracts candidate facts linked to source, unverified and not approved', () => {
    const src = createSource('Test', 'Supercars can exceed 200 miles per hour. They require special tyres for high speed.')
    const facts = extractCandidateFacts(src.rawText, src.id)
    expect(facts.length).toBeGreaterThanOrEqual(1)
    expect(facts[0].sourceId).toBe(src.id)
    expect(facts[0].verificationStatus).toBe('unverified')
    expect(facts[0].approvedForScript).toBe(false)
  })

  it('detects numeric conflicts between different sources on the same topic', () => {
    resetIdCounter(1)
    const s1 = createSource('A', 'placeholder')
    const s2 = createSource('B', 'placeholder')
    const f1 = extractCandidateFacts('The supercar reaches 200 miles per hour on the track.', s1.id)
    const f2 = extractCandidateFacts('The supercar reaches 180 miles per hour on the track.', s2.id)
    const withConflicts = detectConflicts([...f1, ...f2])
    const conflicted = withConflicts.filter(f => f.conflictsWith.length > 0)
    expect(conflicted.length).toBe(2)
  })

  it('approving for script does not change verification status', () => {
    const src = createSource('S', 'x')
    const facts = extractCandidateFacts('Electric vehicles produce zero tailpipe emissions during operation.', src.id)
    const approved = setApprovedForScript(facts, facts[0].id, true)
    expect(approvedFacts(approved)).toHaveLength(1)
    expect(approved[0].verificationStatus).toBe('unverified')
    expect(approved[0].approvedForScript).toBe(true)
  })

  it('verification status can be set independently of approval', () => {
    const src = createSource('S', 'x')
    let facts = extractCandidateFacts('A claim about battery range exists in this sentence here.', src.id)
    facts = setApprovedForScript(facts, facts[0].id, true)
    facts = setVerificationStatus(facts, facts[0].id, 'user-stated')
    expect(facts[0].approvedForScript).toBe(true)
    expect(facts[0].verificationStatus).toBe('user-stated')
  })

  it('research object preserves source text, fact IDs, approval, and conflicts', () => {
    const src = createSource('Export test', 'A claim about battery range exists here for testing purposes.')
    const facts = extractCandidateFacts(src.rawText, src.id)
    const research = {
      subject: 'EV',
      sources: [src],
      facts,
      gaps: [],
      lastUpdated: Date.now(),
    }
    expect(research.sources[0].rawText).toContain('battery')
    expect(research.facts[0].sourceId).toBe(src.id)
    expect(research.facts[0].id).toMatch(/^FCT-/)
    expect(research.facts[0].approvedForScript).toBe(false)
  })
})
