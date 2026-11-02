/** iPhone capability checks. Results are from a real attempt, not API presence alone. */

export const WIKIMEDIA_TEST_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/200px-Tour_Eiffel_Wikimedia_Commons.jpg'

export interface CheckResult {
  name: string
  ok: boolean
  detail: string
  tested: boolean
}

export function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
  ]
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) || null
}

export function classifyBlob(blob: Blob | null): CheckResult {
  if (!blob) {
    return { name: 'MP4 export', ok: false, tested: true, detail: 'No recording blob was produced.' }
  }
  const isMp4 = (blob.type || '').includes('mp4')
  const bigEnough = blob.size > 1000
  if (isMp4 && bigEnough) {
    return {
      name: 'MP4 export',
      ok: true,
      tested: true,
      detail: `Recorded ${blob.size} bytes, type ${blob.type}. This is a real file, not an API check.`,
    }
  }
  return {
    name: 'MP4 export',
    ok: false,
    tested: true,
    detail: `Blob was ${blob.size} bytes, type "${blob.type || 'unknown'}". Not a usable MP4.`,
  }
}

export async function recordCanvasTest(): Promise<{ result: CheckResult; blob: Blob | null }> {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    return {
      blob: null,
      result: { name: 'MP4 export', ok: false, tested: true, detail: 'MediaRecorder is not available in this browser.' },
    }
  }
  const mime = pickRecorderMime()
  if (!mime) {
    return {
      blob: null,
      result: { name: 'MP4 export', ok: false, tested: true, detail: 'MediaRecorder cannot record video/mp4 here.' },
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 180
  const ctx = canvas.getContext('2d')
  if (!ctx || !canvas.captureStream) {
    return {
      blob: null,
      result: { name: 'MP4 export', ok: false, tested: true, detail: 'Canvas capture is not available.' },
    }
  }

  const stream = canvas.captureStream(15)
  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream, { mimeType: mime })
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }))
    recorder.onerror = () => reject(new Error('MediaRecorder error'))
  })

  recorder.start(1000)
  const start = performance.now()
  await new Promise<void>(resolve => {
    const tick = () => {
      const t = (performance.now() - start) / 1000
      ctx.fillStyle = t < 1 ? '#1d4ed8' : '#b45309'
      ctx.fillRect(0, 0, 320, 180)
      ctx.fillStyle = '#fff'
      ctx.font = '20px sans-serif'
      ctx.fillText('FRAMEWORK test', 16, 90)
      if (t < 2) requestAnimationFrame(tick)
      else resolve()
    }
    tick()
  })
  recorder.stop()
  stream.getTracks().forEach(t => t.stop())

  try {
    const blob = await done
    return { blob, result: classifyBlob(blob) }
  } catch (err) {
    return {
      blob: null,
      result: { name: 'MP4 export', ok: false, tested: true, detail: err instanceof Error ? err.message : 'Recording failed.' },
    }
  }
}

export async function fetchWikimedia(): Promise<CheckResult> {
  try {
    const res = await fetch(WIKIMEDIA_TEST_URL, { mode: 'cors' })
    if (!res.ok) {
      return { name: 'Wikimedia fetch', ok: false, tested: true, detail: `HTTP ${res.status}.` }
    }
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) {
      return { name: 'Wikimedia fetch', ok: false, tested: true, detail: `Not an image (${blob.type || 'unknown'}).` }
    }
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { name: 'Wikimedia fetch', ok: false, tested: true, detail: 'Could not read pixels.' }
    ctx.drawImage(bitmap, 0, 0)
    const pixel = ctx.getImageData(1, 1, 1, 1).data
    return {
      name: 'Wikimedia fetch',
      ok: true,
      tested: true,
      detail: `Fetched ${blob.size} bytes, drew ${bitmap.width}x${bitmap.height}, pixel rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}).`,
    }
  } catch (err) {
    return {
      name: 'Wikimedia fetch',
      ok: false,
      tested: true,
      detail: err instanceof Error ? err.message : 'Fetch failed. Likely CORS or network.',
    }
  }
}

export async function readUserPhoto(file: File): Promise<CheckResult> {
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(bitmap.width, 64)
    canvas.height = Math.min(bitmap.height, 64)
    const ctx = canvas.getContext('2d')
    if (!ctx) return { name: 'User photo', ok: false, tested: true, detail: 'Could not read pixels.' }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    ctx.getImageData(0, 0, 1, 1)
    return {
      name: 'User photo',
      ok: true,
      tested: true,
      detail: `Read ${file.name}, ${file.type || 'unknown type'}, ${bitmap.width}x${bitmap.height}.`,
    }
  } catch (err) {
    return {
      name: 'User photo',
      ok: false,
      tested: true,
      detail: err instanceof Error ? err.message : 'Could not read the photo.',
    }
  }
}
