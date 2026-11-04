import { describe, it, expect } from 'vitest'
import { planJob } from '../../../scripts/render-plan.mjs'

const visual = {
  id: 'VIS-1',
  origin: 'external',
  depicts: 'tower',
  obtain: { url: 'https://example.com/a.jpg', licence: 'CC BY-SA', commercialUse: 'yes' },
}

const base = { schema: 'framework-dna', schemaVersion: 1, visuals: [visual] }

describe('scalable timeline', () => {
  it('keeps old DNA on simple fades and does not invent advanced transitions', () => {
    const r = planJob(base)
    expect(r.ok).toBe(true)
    expect(r.shots[0].durationSec).toBe(4)
    expect(r.shots[0].transition.type).toBe('cut')
    expect(r.edit.preset).toBe(null)
  })

  it('plans 30 half-second scenes as a 15-second cut timeline', () => {
    const visuals = Array.from({ length: 30 }, (_, i) => ({ ...visual, id: `VIS-${i + 1}` }))
    const scenes = visuals.map((item, i) => ({
      id: `SC-${i + 1}`,
      visualId: item.id,
      durationSec: 0.5,
      transitionOut: { type: 'cut' },
    }))
    const r = planJob({ ...base, visuals, scenes, edit: { transition: 'cut' } })
    expect(r.ok).toBe(true)
    expect(r.shots).toHaveLength(30)
    expect(r.totalSec).toBe(15)
    expect(r.shots.every(shot => shot.transition.type === 'cut')).toBe(true)
    expect(r.shots.some(shot => shot.transition.advanced)).toBe(false)
  })

  it('places only the requested advanced transitions', () => {
    const visuals = [visual, { ...visual, id: 'VIS-2' }, { ...visual, id: 'VIS-3' }]
    const r = planJob({
      ...base,
      visuals,
      scenes: [
        { id: 'A', visualId: 'VIS-1', durationSec: 1, transitionOut: { type: 'whip-left', durationSec: 0.2 } },
        { id: 'B', visualId: 'VIS-2', durationSec: 1, transitionOut: { type: 'cut' } },
        { id: 'C', visualId: 'VIS-3', durationSec: 1 },
      ],
    })
    expect(r.ok).toBe(true)
    expect(r.shots.map(shot => shot.transition.type)).toEqual(['whip-left', 'cut', 'cut'])
    expect(r.shots[0].transition.ffmpeg).toBe('slideleft')
  })

  it('refuses an unsupported effect instead of substituting', () => {
    const r = planJob({
      ...base,
      scenes: [{ id: 'A', visualId: 'VIS-1', transitionOut: { type: 'magic-sparkle' } }],
    })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('Unsupported transition')
    expect(r.errors.join(' ')).toContain('Not substituting')
  })

  it('lets an explicit transition override a preset', () => {
    const visuals = [visual, { ...visual, id: 'VIS-2' }]
    const r = planJob({
      ...base,
      visuals,
      edit: { preset: 'high-energy' },
      scenes: [
        { id: 'A', visualId: 'VIS-1', durationSec: 1, transitionOut: { type: 'cut' } },
        { id: 'B', visualId: 'VIS-2', durationSec: 1 },
      ],
    })
    expect(r.shots[0].transition.type).toBe('cut')
    expect(r.shots[0].transition.advanced).toBe(false)
  })

  it('accepts a video scene without dropping it', () => {
    const r = planJob({
      ...base,
      visuals: [{ ...visual, id: 'CLIP', mediaType: 'video/mp4', obtain: { ...visual.obtain, url: 'https://example.com/a.mp4' } }],
    })
    expect(r.ok).toBe(true)
    expect(r.shots[0].media).toBe('video')
  })
})
