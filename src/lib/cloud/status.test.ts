import { describe, it, expect } from 'vitest'
import { progressPercent, etaFromSteps, stagesFromSteps } from './status'

describe('cloud status', () => {
  it('returns null progress when there are no steps', () => {
    expect(progressPercent([])).toBeNull()
  })

  it('computes progress from completed steps only', () => {
    const pct = progressPercent([
      { name: 'Validate DNA', status: 'completed', conclusion: 'success' },
      { name: 'Render', status: 'in_progress', conclusion: null },
      { name: 'Set up job', status: 'completed', conclusion: 'success' },
    ])
    expect(pct).toBe(50)
  })

  it('does not invent an ETA without completed step times', () => {
    expect(etaFromSteps([
      { name: 'Validate DNA', status: 'in_progress', conclusion: null },
    ])).toBe('ETA unknown')
  })

  it('estimates ETA from actual completed step durations', () => {
    const eta = etaFromSteps([
      { name: 'Validate DNA', status: 'completed', conclusion: 'success', started_at: '2026-01-01T00:00:00Z', completed_at: '2026-01-01T00:00:10Z' },
      { name: 'Render', status: 'in_progress', conclusion: null },
    ])
    expect(eta).toContain('10s')
  })

  it('marks a failed step', () => {
    const stages = stagesFromSteps([{ name: 'Check MP4', status: 'completed', conclusion: 'failure' }])
    expect(stages[0].state).toBe('failed')
  })
})
