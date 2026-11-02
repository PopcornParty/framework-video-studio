/** Map a real GitHub Actions job into status. No invented progress. */

export interface ApiStep {
  name: string
  status: string
  conclusion: string | null
  started_at?: string | null
  completed_at?: string | null
}

export interface StageView {
  name: string
  state: 'waiting' | 'running' | 'done' | 'failed'
}

const IGNORE = new Set(['Set up job', 'Complete job', 'Post Checkout', 'Post Setup Node'])

export function visibleSteps(steps: ApiStep[]): ApiStep[] {
  return steps.filter(s => !IGNORE.has(s.name) && !s.name.startsWith('Post '))
}

export function stagesFromSteps(steps: ApiStep[]): StageView[] {
  return visibleSteps(steps).map(s => {
    if (s.conclusion === 'failure' || s.conclusion === 'cancelled') return { name: s.name, state: 'failed' }
    if (s.status === 'completed' && s.conclusion === 'success') return { name: s.name, state: 'done' }
    if (s.status === 'in_progress') return { name: s.name, state: 'running' }
    return { name: s.name, state: 'waiting' }
  })
}

export function progressPercent(steps: ApiStep[]): number | null {
  const visible = visibleSteps(steps)
  if (!visible.length) return null
  const done = visible.filter(s => s.status === 'completed' && s.conclusion === 'success').length
  return Math.round((done / visible.length) * 100)
}

export function etaFromSteps(steps: ApiStep[], now = Date.now()): string {
  const visible = visibleSteps(steps)
  const done = visible.filter(s => s.completed_at && s.started_at && s.conclusion === 'success')
  const remaining = visible.length - done.length
  if (!done.length || remaining <= 0) return 'ETA unknown'
  const spent = done.reduce((sum, s) => {
    const a = new Date(s.started_at as string).getTime()
    const b = new Date(s.completed_at as string).getTime()
    return sum + Math.max(0, b - a)
  }, 0)
  if (spent < 1000) return 'ETA unknown'
  const seconds = Math.round((spent / done.length) * remaining / 1000)
  if (!Number.isFinite(seconds) || seconds < 1) return 'ETA unknown'
  return `About ${seconds}s from completed steps`
}
