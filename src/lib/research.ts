/** Pure research utilities — no side effects, fully testable. */

export interface Source {
  id: string
  label: string
  rawText: string
  publishedAt?: string
  addedAt: number
}

export type VerificationStatus = 'verified' | 'user-stated' | 'unverified' | 'assumption'

export interface Fact {
  id: string
  statement: string
  sourceId: string
  verificationStatus: VerificationStatus
  approvedForScript: boolean
  conflictsWith: string[]
}

export interface Research {
  subject: string
  sources: Source[]
  facts: Fact[]
  gaps: string[]
  lastUpdated: number
}

export type ScriptTreatment =
  | 'established-fact'
  | 'attributed'
  | 'qualified-or-exclude'
  | 'never-as-fact'

export function scriptTreatment(status: VerificationStatus): ScriptTreatment {
  switch (status) {
    case 'verified': return 'established-fact'
    case 'user-stated': return 'attributed'
    case 'unverified': return 'qualified-or-exclude'
    case 'assumption': return 'never-as-fact'
  }
}

export function allowedScriptUse(fact: Fact): ScriptTreatment | null {
  if (!fact.approvedForScript) return null
  return scriptTreatment(fact.verificationStatus)
}

let idCounter = 1
export function resetIdCounter(n = 1) {
  idCounter = n
}
function nextId(prefix: string): string {
  return `${prefix}-${String(idCounter++).padStart(4, '0')}`
}

/**
 * Split text into sentences without breaking on:
 * - decimal numbers (8.0, 1.5)
 * - thousands separators (1,500)
 * - percentages (3.5%)
 * - common abbreviations (e.g., i.e., etc., Dr., Mr.)
 */
export function splitSentences(text: string): string[] {
  if (!text.trim()) return []
  const protectedText = text
    .replace(/(\d)\.(\d)/g, '$1§DEC§$2')
    .replace(/(\d),(\d{3})/g, '$1§COM§$2')
    .replace(/\b(e\.g|i\.e|etc|Dr|Mr|Mrs|Ms|Prof|vs|Fig|approx|No)\./gi, '$1§ABBR§')

  const parts = protectedText
    .split(/[.!?]+/)
    .map(s => s
      .replace(/§DEC§/g, '.')
      .replace(/§COM§/g, ',')
      .replace(/§ABBR§/g, '.')
      .trim()
    )
    .filter(s => s.length > 15 && s.split(/\s+/).length >= 4)

  return parts
}

export function extractCandidateFacts(text: string, sourceId: string): Fact[] {
  const sentences = splitSentences(text)
  return sentences.map(statement => ({
    id: nextId('FCT'),
    statement,
    sourceId,
    verificationStatus: 'unverified' as const,
    approvedForScript: false,
    conflictsWith: [],
  }))
}

export function detectConflicts(facts: Fact[]): Fact[] {
  const result = facts.map(f => ({ ...f, conflictsWith: [...f.conflictsWith] }))
  const numberPattern = /\b(\d+(?:\.\d+)?)\b/g

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i]
      const b = result[j]
      if (a.sourceId === b.sourceId) continue
      const aNums = [...a.statement.matchAll(numberPattern)].map(m => m[1])
      const bNums = [...b.statement.matchAll(numberPattern)].map(m => m[1])
      if (aNums.length === 0 || bNums.length === 0) continue
      const sharedTopic = shareSignificantWords(a.statement, b.statement)
      if (sharedTopic && aNums.some(n => !bNums.includes(n))) {
        if (!a.conflictsWith.includes(b.id)) a.conflictsWith.push(b.id)
        if (!b.conflictsWith.includes(a.id)) b.conflictsWith.push(a.id)
      }
    }
  }
  return result
}

function shareSignificantWords(a: string, b: string): boolean {
  const stop = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or'])
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stop.has(w)))
  const wordsB = b.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stop.has(w))
  return wordsB.some(w => wordsA.has(w))
}

export function createSource(label: string, rawText: string, publishedAt?: string): Source {
  return {
    id: nextId('SRC'),
    label: label.trim() || 'Untitled source',
    rawText,
    publishedAt,
    addedAt: Date.now(),
  }
}

export function setApprovedForScript(facts: Fact[], factId: string, approved: boolean): Fact[] {
  return facts.map(f => f.id === factId ? { ...f, approvedForScript: approved } : f)
}

export function setVerificationStatus(facts: Fact[], factId: string, status: VerificationStatus): Fact[] {
  return facts.map(f => f.id === factId ? { ...f, verificationStatus: status } : f)
}

export function approvedFacts(facts: Fact[]): Fact[] {
  return facts.filter(f => f.approvedForScript)
}
