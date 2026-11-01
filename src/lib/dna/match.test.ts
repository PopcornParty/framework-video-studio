import { describe, it, expect } from 'vitest'
import { matchUserMedia, DroppedFile } from './match'
import type { DnaVisual } from './types'

const vis = (over: Partial<DnaVisual> = {}): DnaVisual => ({
  id: 'USR-1',
  origin: 'user-provided',
  depicts: 'road',
  originalFilename: 'clip.mov',
  inspected: true,
  required: true,
  mediaType: 'video',
  fileSize: 1000,
  ...over,
})

const file = (over: Partial<DroppedFile> = {}): DroppedFile => ({
  name: 'clip.mov',
  size: 1000,
  type: 'video/quicktime',
  hash: 'abc',
  readable: true,
  ...over,
})

describe('matchUserMedia', () => {
  it('matches by filename and size', () => {
    const r = matchUserMedia([vis()], [file()])
    expect(r.ok).toBe(true)
    expect(r.matched[0].assetId).toBe('USR-1')
    expect(r.matched[0].hash).toBe('abc')
  })

  it('fails required missing asset', () => {
    const r = matchUserMedia([vis()], [])
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('USR-1')
  })

  it('does not guess when two files match', () => {
    const r = matchUserMedia([vis({ fileSize: undefined })], [file(), file({ hash: 'def' })])
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('Ambiguous')
  })

  it('rejects unreadable file', () => {
    const r = matchUserMedia([vis()], [file({ readable: false })])
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('USR-1')
  })

  it('rejects wrong media family', () => {
    const r = matchUserMedia([vis()], [file({ type: 'image/jpeg' })])
    expect(r.ok).toBe(false)
  })

  it('ignores unused uploads', () => {
    const r = matchUserMedia([vis()], [file(), file({ name: 'other.jpg', type: 'image/jpeg', size: 5 })])
    expect(r.ok).toBe(true)
    expect(r.ignored).toContain('other.jpg')
  })

  it('does not match external visuals', () => {
    const external: DnaVisual = {
      id: 'VIS-1', origin: 'external', depicts: 'car',
      obtain: { url: 'https://example.com/a.jpg', licence: 'CC BY', commercialUse: 'yes' },
    }
    const r = matchUserMedia([external], [])
    expect(r.ok).toBe(true)
    expect(r.matched).toHaveLength(0)
  })
})
