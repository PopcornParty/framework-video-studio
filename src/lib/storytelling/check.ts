import { getStructure } from './select'
import type { Fact } from '../research'

export interface CheckInput {
  structureId: string
  approvedFacts: Fact[]
  requestedDurationSec: number
  prompt: string
}

export interface CheckResult {
  ok: boolean
  issues: string[]
}

export function checkSufficientInformation(input: CheckInput): CheckResult {
  const issues: string[] = []
  const structure = getStructure(input.structureId)
  if (!structure) {
    return { ok: false, issues: ['Unknown structure'] }
  }

  const usable = input.approvedFacts.filter(
    f => f.verificationStatus === 'verified' || f.verificationStatus === 'user-stated'
  )
  const assumptionsOnly = input.approvedFacts.length > 0 && usable.length === 0

  if (structure.minVerifiedFacts > 0 && usable.length < structure.minVerifiedFacts) {
    issues.push(`Structure "${structure.name}" needs at least ${structure.minVerifiedFacts} verified or user-stated fact(s). Currently ${usable.length}.`)
  }
  if (assumptionsOnly) {
    issues.push('Only assumptions are approved. Assumptions must never be presented as established facts.')
  }
  if (!input.prompt.trim()) {
    issues.push('Prompt is empty.')
  }

  const [minD, maxD] = structure.typicalDurationSec
  if (input.requestedDurationSec < 10) {
    issues.push('Requested duration is under 10 seconds, which is too short for a coherent structure.')
  }
  if (input.requestedDurationSec > maxD * 1.5) {
    issues.push(`Requested duration (${input.requestedDurationSec}s) is long for "${structure.name}" (typical ${minD}–${maxD}s). Consider a simpler structure or more material.`)
  }

  if (structure.id === 'comparison' && !/\b(vs|versus|compare|difference|or)\b/i.test(input.prompt)) {
    issues.push('Comparison structure selected but prompt does not clearly name two sides.')
  }
  if (structure.id === 'list' && usable.length < 3 && input.approvedFacts.length < 3) {
    issues.push('List structure works best with at least three distinct points. Fewer were found.')
  }

  return { ok: issues.length === 0, issues }
}
