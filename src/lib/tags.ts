/** Pure tag utilities — easily testable, no side effects. */

export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '') // strip special chars except hyphen
    .trim()
}

export function parseTags(input: string): string[] {
  if (!input) return []
  const parts = input.split(/[,;\n\r]+/)
  const seen = new Set<string>()
  const result: string[] = []
  for (const part of parts) {
    const tag = normalizeTag(part)
    if (tag && !seen.has(tag)) {
      seen.add(tag)
      result.push(tag)
    }
  }
  return result
}

export function mergeTags(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map(normalizeTag))
  const result = [...existing]
  for (const tag of incoming) {
    const n = normalizeTag(tag)
    if (n && !seen.has(n)) {
      seen.add(n)
      result.push(n)
    }
  }
  return result
}

export function suggestTags(allTags: string[], query: string, limit = 8): string[] {
  const q = normalizeTag(query)
  if (!q) return allTags.slice(0, limit)
  return allTags
    .filter(t => t.includes(q))
    .sort((a, b) => {
      const aStarts = a.startsWith(q) ? 0 : 1
      const bStarts = b.startsWith(q) ? 0 : 1
      return aStarts - bStarts || a.localeCompare(b)
    })
    .slice(0, limit)
}
