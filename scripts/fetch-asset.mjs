/**
 * Asset downloads for cloud renders.
 * Retries temporary HTTP failures. Never substitutes a different asset.
 */

export const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504])
export const MAX_ATTEMPTS = 5
export const COMMONS_CONCURRENCY = 2

const DEFAULT_HEADERS = {
  'User-Agent': 'FRAMEWORKVideoStudio/0.1 (https://github.com/PopcornParty/framework-video-studio)',
  'Accept': 'image/avif,image/webp,image/apng,image/*,video/*,*/*;q=0.8',
}

export function isWikimedia(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'commons.wikimedia.org'
      || host.endsWith('.wikimedia.org')
      || host.endsWith('.wikipedia.org')
  } catch {
    return false
  }
}

export function parseRetryAfter(value, now = Date.now()) {
  if (value == null || value === '') return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  if (Number.isFinite(date)) return Math.max(0, date - now)
  return null
}

export function retryDelayMs({ attempt = 0, retryAfter = null, random = Math.random, now = Date.now() } = {}) {
  const header = parseRetryAfter(retryAfter, now)
  if (header != null) return header
  const base = Math.min(8000, 500 * (2 ** attempt))
  return base + Math.floor(random() * 250)
}

export function failureMessage(sceneId, url, status) {
  return `Could not fetch ${sceneId}: HTTP ${status} ${url}`
}

export function createLimiter(limit) {
  let active = 0
  const waiting = []
  return async function limitRun(task) {
    if (active >= limit) {
      await new Promise(resolve => waiting.push(resolve))
    }
    active += 1
    try {
      return await task()
    } finally {
      active -= 1
      const next = waiting.shift()
      if (next) next()
    }
  }
}

export async function fetchWithRetry(url, {
  sceneId = 'asset',
  fetchImpl = fetch,
  sleep = delay => new Promise(resolve => setTimeout(resolve, delay)),
  cache = new Map(),
  maxAttempts = MAX_ATTEMPTS,
  random = Math.random,
  now = () => Date.now(),
} = {}) {
  if (cache.has(url)) return { ok: true, bytes: cache.get(url), cached: true, attempts: 0 }

  let lastStatus = 0
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let response
    try {
      response = await fetchImpl(url, { headers: DEFAULT_HEADERS })
    } catch (err) {
      lastStatus = 0
      if (attempt === maxAttempts - 1) {
        return { ok: false, status: 0, url, sceneId, error: `${failureMessage(sceneId, url, 'network')} ${err instanceof Error ? err.message : ''}`.trim() }
      }
      await sleep(retryDelayMs({ attempt, random, now: now() }))
      continue
    }

    if (response.ok) {
      const bytes = Buffer.from(await response.arrayBuffer())
      cache.set(url, bytes)
      return { ok: true, bytes, cached: false, attempts: attempt + 1, status: response.status }
    }

    lastStatus = response.status
    const retryAfter = response.headers?.get?.('retry-after') ?? null
    const retryable = RETRY_STATUSES.has(response.status)
    if (!retryable || attempt === maxAttempts - 1) {
      return { ok: false, status: lastStatus, url, sceneId, error: failureMessage(sceneId, url, lastStatus) }
    }
    await sleep(retryDelayMs({ attempt, retryAfter, random, now: now() }))
  }

  return { ok: false, status: lastStatus, url, sceneId, error: failureMessage(sceneId, url, lastStatus) }
}

export async function downloadShots(shots, {
  fetchImpl = fetch,
  sleep,
  cache = new Map(),
  commonsLimit = COMMONS_CONCURRENCY,
  otherLimit = 4,
} = {}) {
  const commons = createLimiter(commonsLimit)
  const other = createLimiter(otherLimit)
  let commonsActive = 0
  let commonsPeak = 0

  const results = await Promise.all(shots.map(async shot => {
    if (shot.kind !== 'url') return { shot, local: true }
    const limiter = isWikimedia(shot.url) ? commons : other
    return limiter(async () => {
      if (isWikimedia(shot.url)) {
        commonsActive += 1
        commonsPeak = Math.max(commonsPeak, commonsActive)
      }
      try {
        const result = await fetchWithRetry(shot.url, { sceneId: shot.id, fetchImpl, sleep, cache })
        return { shot, ...result }
      } finally {
        if (isWikimedia(shot.url)) commonsActive -= 1
      }
    })
  }))

  return { results, commonsPeak, cache }
}
