import { describe, it, expect } from 'vitest'
import { classifyBlob, pickRecorderMime, WIKIMEDIA_TEST_URL } from './capability'

describe('capability checks', () => {
  it('uses a Wikimedia Commons thumbnail URL', () => {
    expect(WIKIMEDIA_TEST_URL).toContain('upload.wikimedia.org')
    expect(WIKIMEDIA_TEST_URL).toContain('200px-')
  })

  it('rejects an empty recording', () => {
    const r = classifyBlob(null)
    expect(r.ok).toBe(false)
    expect(r.tested).toBe(true)
  })

  it('rejects a tiny or non-mp4 blob', () => {
    const r = classifyBlob(new Blob(['x'], { type: 'video/webm' }))
    expect(r.ok).toBe(false)
  })

  it('accepts a real-sized mp4 blob', () => {
    const r = classifyBlob(new Blob([new Uint8Array(2000)], { type: 'video/mp4' }))
    expect(r.ok).toBe(true)
    expect(r.detail).toContain('2000')
  })

  it('does not treat missing MediaRecorder as success', () => {
    expect(pickRecorderMime()).toBeNull()
  })
})
