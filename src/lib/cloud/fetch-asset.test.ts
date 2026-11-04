import { describe, it, expect } from 'vitest'
import {
  COMMONS_CONCURRENCY,
  downloadShots,
  fetchWithRetry,
  parseRetryAfter,
  retryDelayMs,
} from '../../../scripts/fetch-asset.mjs'

function response(status, { body = 'img', retryAfter = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => name.toLowerCase() === 'retry-after' ? retryAfter : null },
    arrayBuffer: async () => Buffer.from(body),
  }
}

describe('asset download retries', () => {
  it('retries HTTP 429 and succeeds', async () => {
    const calls = []
    const sleeps = []
    const fetchImpl = async url => {
      calls.push(url)
      return calls.length === 1 ? response(429) : response(200, { body: 'ok' })
    }
    const result = await fetchWithRetry('https://commons.wikimedia.org/wiki/Special:FilePath/car.jpg', {
      sceneId: 'SC11',
      fetchImpl,
      sleep: ms => { sleeps.push(ms); return Promise.resolve() },
      random: () => 0,
    })
    expect(result.ok).toBe(true)
    expect(result.bytes.toString()).toBe('ok')
    expect(calls).toHaveLength(2)
    expect(sleeps[0]).toBe(500)
  })

  it('waits for Retry-After before the next attempt', async () => {
    const sleeps = []
    let n = 0
    const fetchImpl = async () => {
      n += 1
      return n === 1 ? response(429, { retryAfter: '3' }) : response(200)
    }
    const result = await fetchWithRetry('https://upload.wikimedia.org/a.jpg', {
      sceneId: 'SC2',
      fetchImpl,
      sleep: ms => { sleeps.push(ms); return Promise.resolve() },
    })
    expect(result.ok).toBe(true)
    expect(sleeps).toEqual([3000])
    expect(parseRetryAfter('3')).toBe(3000)
  })

  it('reports scene, URL and status on a permanent failure', async () => {
    const fetchImpl = async () => response(404)
    const result = await fetchWithRetry('https://example.com/missing.jpg', {
      sceneId: 'SC11',
      fetchImpl,
      sleep: async () => {},
    })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
    expect(result.error).toBe('Could not fetch SC11: HTTP 404 https://example.com/missing.jpg')
  })

  it('does not replace a permanently rate-limited image', async () => {
    const fetchImpl = async () => response(429, { retryAfter: '1' })
    const result = await fetchWithRetry('https://commons.wikimedia.org/wiki/Special:FilePath/Red_2024_Lamborghini_Revuelto_SCD_24.jpg', {
      sceneId: 'SC11',
      fetchImpl,
      sleep: async () => {},
      maxAttempts: 2,
    })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(429)
    expect(result.error).toContain('SC11')
    expect(result.error).toContain('HTTP 429')
    expect(result.error).toContain('Red_2024_Lamborghini_Revuelto_SCD_24.jpg')
  })

  it('caches a successful download and does not fetch it again', async () => {
    let calls = 0
    const cache = new Map()
    const fetchImpl = async () => { calls += 1; return response(200, { body: 'once' }) }
    const first = await fetchWithRetry('https://example.com/a.jpg', { fetchImpl, cache })
    const second = await fetchWithRetry('https://example.com/a.jpg', { fetchImpl, cache })
    expect(first.cached).toBe(false)
    expect(second.cached).toBe(true)
    expect(calls).toBe(1)
    expect(second.bytes).toEqual(first.bytes)
  })

  it('keeps Wikimedia downloads at two or fewer at a time', async () => {
    let active = 0
    let peak = 0
    const fetchImpl = async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 20))
      active -= 1
      return response(200, { body: 'x' })
    }
    const shots = Array.from({ length: 8 }, (_, i) => ({
      id: `SC${i + 1}`,
      kind: 'url',
      url: `https://commons.wikimedia.org/wiki/Special:FilePath/car-${i}.jpg`,
    }))
    const { commonsPeak } = await downloadShots(shots, { fetchImpl, commonsLimit: COMMONS_CONCURRENCY })
    expect(peak).toBeLessThanOrEqual(2)
    expect(commonsPeak).toBeLessThanOrEqual(2)
    expect(retryDelayMs({ attempt: 3, random: () => 0 })).toBe(4000)
  })
})
