/** Pure research utilities — no side effects, fully testable. */

export interface Source {
  id: string
  label: string
  rawText: string
  publishedAt?: string
  addedAt: number
}

export interface Fact {
  id: string
  statement: string
  sourceId: string
  confidence: 'user-verified' | 'assumption' | 'candidate'
  conflictsWith: string[]
}

export interface Research {
  subject: string
  sources: Source[]
  facts: Fact[]
  gaps: string[]
  lastUpdated: number
}

let idCounter = 1
export function resetIdCounter(n = 1) {
  idCounter = n
}
function nextId(prefix: string): string {
  return `${prefix}-${String(idCounter++).padStart(4, '0')}`
}

export function extractCandidateFacts(text: string, sourceId: string): Fact[] {
  if (!text.trim()) return []
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.split(/\s+/).length >= 4)
  return sentences.map(statement => ({
    id: nextId('FCT'),
    statement,
    sourceId,
    confidence: 'candidate' as const,
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

export function markFact(facts: Fact[], factId: string, confidence: Fact['confidence']): Fact[] {
  return facts.map(f => f.id === factId ? { ...f, confidence } : f)
}

export function verifiedFacts(facts: Fact[]): Fact[] {
  return facts.filter(f => f.confidence === 'user-verified')
}
