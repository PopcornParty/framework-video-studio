import { describe, it, expect, beforeEach } from 'vitest'
import {
  createSource,
  extractCandidateFacts,
  detectConflicts,
  markFact,
  verifiedFacts,
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
    expect(s2.label).toBe('Article')
  })

  it('extracts candidate facts from source text', () => {
    const src = createSource('Test', 'Supercars can exceed 200 miles per hour. They require special tyres for high speed.')
    const facts = extractCandidateFacts(src.rawText, src.id)
    expect(facts.length).toBeGreaterThanOrEqual(1)
    expect(facts[0].sourceId).toBe(src.id)
    expect(facts[0].confidence).toBe('candidate')
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

  it('allows marking a fact as user-verified', () => {
    const src = createSource('S', 'x')
    const facts = extractCandidateFacts('Electric vehicles produce zero tailpipe emissions during operation.', src.id)
    const marked = markFact(facts, facts[0].id, 'user-verified')
    expect(verifiedFacts(marked)).toHaveLength(1)
    expect(verifiedFacts(marked)[0].id).toBe(facts[0].id)
  })

  it('export-shaped research object contains fact and source IDs', () => {
    const src = createSource('Export test', 'A verified claim about battery range exists here.')
    const facts = extractCandidateFacts(src.rawText, src.id)
    const research = {
      subject: 'EV',
      sources: [src],
      facts,
      gaps: [],
      lastUpdated: Date.now(),
    }
    expect(research.sources[0].id).toMatch(/^SRC-/)
    expect(research.facts[0].sourceId).toBe(src.id)
    expect(research.facts[0].id).toMatch(/^FCT-/)
  })
})
