import { STRUCTURES, HOOKS, StoryStructure, HookPattern } from './knowledge'
import type { Fact } from '../research'

export interface SelectionInput {
  prompt: string
  approvedFacts: Fact[]
  requestedDurationSec: number
}

export interface SelectionResult {
  recommendedStructureId: string
  reason: string
  scores: { id: string; score: number }[]
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(Boolean)
}

export function recommendStructure(input: SelectionInput): SelectionResult {
  const tokens = tokenize(input.prompt)
  const verifiedCount = input.approvedFacts.filter(f => f.verificationStatus === 'verified' || f.verificationStatus === 'user-stated').length

  const scores = STRUCTURES.map(s => {
    let score = 0
    for (const keyword of s.bestFor) {
      if (tokens.some(t => keyword.includes(t) || t.includes(keyword.split(' ')[0]))) score += 2
      if (input.prompt.toLowerCase().includes(keyword)) score += 3
    }
    if (verifiedCount >= s.minVerifiedFacts) score += 1
    else score -= 2
    const [minD, maxD] = s.typicalDurationSec
    if (input.requestedDurationSec >= minD && input.requestedDurationSec <= maxD) score += 1
    return { id: s.id, score }
  })

  scores.sort((a, b) => b.score - a.score)
  const best = scores[0]
  const structure = STRUCTURES.find(s => s.id === best.id)!
  const reason = best.score > 0
    ? `Matched keywords and constraints for ${structure.name}.`
    : `No strong keyword match; defaulting to ${structure.name} as the least unsuitable option.`

  return {
    recommendedStructureId: best.id,
    reason,
    scores,
  }
}

export function recommendHook(structureId: string, hasVerifiedFact: boolean): HookPattern {
  const candidates = HOOKS.filter(h => h.bestWith.includes(structureId))
  const usable = candidates.filter(h => !h.requiresVerifiedFact || hasVerifiedFact)
  return usable[0] || HOOKS.find(h => h.id === 'direct-address')!
}

export function getStructure(id: string): StoryStructure | undefined {
  return STRUCTURES.find(s => s.id === id)
}
