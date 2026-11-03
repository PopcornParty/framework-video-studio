import { describe, it, expect } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { planJob } from '../../../scripts/render-plan.mjs'
import { DELIVERABLES, stageDebug, stageDeliverables } from '../../../scripts/package-render.mjs'
import {
  buildCues,
  phrasesOf,
  scriptLines,
  splitLongCaption,
  toAss,
  toSrt,
  tokenize,
  validateCues,
  wrapCaption,
} from '../../../scripts/subtitles.mjs'

const visual = {
  id: 'VIS-1',
  origin: 'external',
  depicts: 'tower',
  obtain: {
    url: 'https://example.com/a.jpg',
    licence: 'CC BY-SA',
    commercialUse: 'yes',
  },
}

const base = {
  schema: 'framework-dna',
  schemaVersion: 1,
  visuals: [visual],
}

describe('renderer upgrade', () => {
  it('keeps older DNA renderable with defaults', () => {
    const r = planJob(base)
    expect(r.ok).toBe(true)
    expect(r.shots[0].durationSec).toBe(4)
    expect(r.music.enabled).toBe(false)
    expect(r.edit.transition).toBe('fade')
  })

  it('uses scene duration overrides and refuses missing music', () => {
    const timed = planJob({
      ...base,
      visuals: [{ ...visual, durationSec: 6, motion: 'pan-left' }],
    })
    expect(timed.shots[0].durationSec).toBe(6)
    expect(timed.shots[0].motion).toBe('pan-left')

    const missing = planJob({
      ...base,
      music: { enabled: true, origin: 'user-provided', originalFilename: 'song.mp3', obtain: { licence: 'owned', commercialUse: 'yes' } },
    }, [])
    expect(missing.ok).toBe(false)
    expect(missing.errors.join(' ')).toContain('Not substituting')
  })

  it('refuses unlicensed or invalid music instead of substituting', () => {
    const noLicence = planJob({
      ...base,
      music: { enabled: true, origin: 'external', obtain: { url: 'https://example.com/a.mp3' } },
    })
    expect(noLicence.ok).toBe(false)
    const badUrl = planJob({
      ...base,
      music: { enabled: true, origin: 'external', obtain: { url: 'http://example.com/a.mp3', licence: 'CC0', commercialUse: 'yes' } },
    })
    expect(badUrl.ok).toBe(false)
  })

  it('accepts licensed music and preserves punctuation', () => {
    const r = planJob({
      ...base,
      music: { enabled: true, origin: 'external', volume: 0.8, obtain: { url: 'https://example.com/a.mp3', licence: 'CC0', commercialUse: 'yes', attribution: 'Example' } },
    })
    expect(r.ok).toBe(true)
    expect(r.music.licence).toBe('CC0')
    expect(r.music.volume).toBe(0.8)
    expect(r.music.source).toBe('https://example.com/a.mp3')
    expect(tokenize('Hello, world! How are you?')).toEqual(['Hello,', 'world!', 'How', 'are', 'you?'])
  })

  it('times every script line and wraps long captions', () => {
    const dna = {
      ...base,
      visuals: [visual, { ...visual, id: 'VIS-2', durationSec: 5 }],
      script: {
        lines: [
          { id: 'L1', text: 'Hello, world!' },
          { id: 'L2', text: 'This is a deliberately long caption that must wrap onto more than one line without losing punctuation.' },
        ],
      },
    }
    const plan = planJob(dna)
    const { cues, total } = buildCues(dna, plan.shots, plan.edit.transitionSec)
    expect(scriptLines(dna)).toHaveLength(2)
    expect(cues.length).toBeGreaterThan(2)
    expect(cues.some(cue => cue.text.includes('Hello,'))).toBe(true)
    expect(cues.every(cue => cue.end <= total + 0.05)).toBe(true)
    expect(validateCues(cues, total)).toEqual([])
    expect(wrapCaption(dna.script.lines[1].text).length).toBeLessThanOrEqual(2)
    expect(splitLongCaption(dna.script.lines[1].text).length).toBeGreaterThan(1)
  })

  it('honours manual timing and writes SRT plus ASS', () => {
    const dna = {
      ...base,
      script: { lines: [{ id: 'L1', text: 'Exact timing, please.', startSec: 0.4, endSec: 2.2, highlight: ['Exact'] }] },
    }
    const plan = planJob(dna)
    const { cues, settings } = buildCues(dna, plan.shots, 0)
    expect(cues[0].start).toBeGreaterThanOrEqual(0.4)
    expect(cues.at(-1).end).toBeLessThanOrEqual(2.2)
    const srt = toSrt(cues)
    const ass = toAss(cues, settings)
    expect(srt).toContain('Exact timing,')
    expect(srt).toContain('-->')
    expect(ass).toContain('PlayResY: 1920')
    expect(ass).toContain('\\fad')
    expect(ass).toContain('MarginV')
    expect(phrasesOf('One two three four five')).toEqual(['One two three', 'four five'])
  })

  it('defaults music to an audible normalized level and packages only deliverables', async () => {
    const r = planJob({
      ...base,
      music: { enabled: true, origin: 'user-provided', originalFilename: 'song.mp3', obtain: { licence: 'owned', commercialUse: 'yes' } },
    }, ['song.mp3'])
    expect(r.ok).toBe(true)
    expect(r.music.volume).toBe(1)
    expect(r.music.source).toBe('user-file:song.mp3')

    const dir = await mkdtemp(path.join(tmpdir(), 'fw-pack-'))
    const dist = path.join(dir, 'dist')
    const debug = path.join(dir, 'debug')
    await writeFile(path.join(dir, 'video.mp4'), 'mp4')
    await writeFile(path.join(dir, 'subtitles.srt'), 'srt')
    await writeFile(path.join(dir, 'subtitles.ass'), 'ass')
    await writeFile(path.join(dir, 'report.txt'), 'OK\nmusic=yes\n')
    await writeFile(path.join(dir, 'music.bin'), 'audio')
    await writeFile(path.join(dir, 'VIS-1.mp4'), 'scene')
    const staged = await stageDeliverables(dir, dist)
    const debugFiles = await stageDebug(dir, debug)
    expect(staged).toEqual(DELIVERABLES)
    expect(debugFiles.sort()).toEqual(['VIS-1.mp4', 'music.bin'])
    await rm(dir, { recursive: true, force: true })
  })

  it('syncs a line to its scene and can disable subtitles', () => {
    const dna = {
      ...base,
      visuals: [visual, { ...visual, id: 'VIS-2' }],
      script: { lines: [{ id: 'L1', text: 'Second scene.', sceneId: 'VIS-2' }] },
    }
    const plan = planJob(dna)
    const { cues } = buildCues(dna, plan.shots, plan.edit.transitionSec)
    expect(cues[0].start).toBeGreaterThanOrEqual(4 - plan.edit.transitionSec)
    const off = buildCues({ ...dna, subtitles: { enabled: false } }, plan.shots, 0)
    expect(off.cues).toEqual([])
  })
})
