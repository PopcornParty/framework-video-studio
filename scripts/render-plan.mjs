/** Decide what a cloud render may do. No network. No ffmpeg. No fake success. */
import { LIMITS, PRESETS, resolveTransition } from './transitions.mjs'

export { LIMITS }

export function planJob(dna, availableFiles = []) {
  const errors = []
  const shots = []
  if (!dna || dna.schema !== 'framework-dna' || dna.schemaVersion !== 1) {
    return { ok: false, errors: ['DNA must be framework-dna schemaVersion 1.'], shots: [] }
  }
  const visuals = Array.isArray(dna.visuals) ? dna.visuals : []
  if (visuals.length === 0) {
    return { ok: false, errors: ['DNA has no visuals. Refusing to invent footage.'], shots: [] }
  }
  const files = new Set(availableFiles.map(f => String(f).toLowerCase()))
  const visualById = new Map()
  for (const v of visuals) {
    const shot = acceptVisual(v, files, errors)
    if (shot) visualById.set(v.id, shot)
  }

  const timeline = buildTimeline(dna, visualById, errors)
  if (timeline.length > LIMITS.maxScenes) {
    errors.push(`This production has ${timeline.length} scenes. The practical cloud limit is ${LIMITS.maxScenes}.`)
  }
  const total = timeline.reduce((sum, shot, index) => {
    const overlap = index < timeline.length - 1 ? shot.transition.durationSec : 0
    return sum + shot.durationSec - overlap
  }, 0)
  if (total > LIMITS.maxTotalSec) {
    errors.push(`Timeline is ${total.toFixed(1)}s. The practical cloud limit is ${LIMITS.maxTotalSec}s.`)
  }
  if (!timeline.length && !errors.length) errors.push('No usable visuals after checks.')

  const music = planMusic(dna, availableFiles)
  if (music.error) errors.push(music.error)

  return {
    ok: errors.length === 0,
    errors,
    shots: timeline,
    music: music.error ? null : music,
    edit: editSettings(dna),
    limits: LIMITS,
    totalSec: Math.round(total * 1000) / 1000,
  }
}

function acceptVisual(v, files, errors) {
  const media = mediaKind(v)
  if (v.origin === 'user-provided') {
    const name = v.originalFilename || ''
    if (!files.has(name.toLowerCase())) {
      if (v.required !== false) errors.push(`Missing user asset ${v.id} (${name || 'unnamed'}). Upload it in the job folder. Not substituting.`)
      return null
    }
    return shotFrom(v, 'file', { file: name, media })
  }
  if (v.origin === 'external') {
    const url = v.obtain?.url || ''
    if (!url.startsWith('https://')) {
      errors.push(`External visual ${v.id} needs an https URL.`)
      return null
    }
    if (!v.obtain?.licence || !v.obtain?.commercialUse || v.obtain.commercialUse === 'unknown') {
      errors.push(`External visual ${v.id} needs a licence and known commercialUse.`)
      return null
    }
    return shotFrom(v, 'url', { url, media })
  }
  errors.push(`Visual ${v.id} has an unknown origin.`)
  return null
}

function buildTimeline(dna, visualById, errors) {
  const requested = Array.isArray(dna.scenes) && dna.scenes.length
    ? dna.scenes
    : [...visualById.values()].map(shot => ({ id: shot.id, visualId: shot.id, durationSec: shot.durationSec, motion: shot.motion }))
  const preset = PRESETS[dna.edit?.preset] ? dna.edit.preset : null
  const fallback = dna.edit?.transition || 'fade'
  const shots = []
  requested.forEach((scene, index) => {
    const source = visualById.get(scene.visualId || scene.id)
    if (!source) {
      errors.push(`Scene ${scene.id || index + 1} points at missing visual ${scene.visualId || scene.id}.`)
      return
    }
    const durationSec = clamp(scene.durationSec ?? source.durationSec, LIMITS.minDurationSec, LIMITS.maxDurationSec, source.durationSec || 4)
    const transition = resolveTransition(scene.transitionOut, preset, fallback, index)
    if (transition.error) {
      errors.push(`${transition.error} Scene ${scene.id || source.id}.`)
      return
    }
    if (index === requested.length - 1) {
      transition.type = 'cut'
      transition.ffmpeg = null
      transition.durationSec = 0
      transition.advanced = false
    }
    shots.push({
      ...source,
      id: scene.id || source.id,
      visualId: source.id,
      durationSec,
      startSec: Number.isFinite(scene.startSec) ? scene.startSec : null,
      motion: scene.motion || source.motion,
      speed: clamp(scene.speed, 0.25, 4, 1),
      crop: scene.crop || null,
      text: typeof scene.text === 'string' ? scene.text : '',
      transition,
    })
  })
  let cursor = 0
  for (const shot of shots) {
    if (shot.startSec == null) shot.startSec = Math.round(cursor * 1000) / 1000
    cursor = shot.startSec + shot.durationSec - shot.transition.durationSec
  }
  return shots
}

export function planMusic(dna, availableFiles = []) {
  const music = dna?.music
  if (!music || music.enabled === false) return { enabled: false }
  const files = new Set(availableFiles.map(f => String(f).toLowerCase()))
  const volume = clamp(music.volume, 0.4, 1.4, 1)
  const fadeInSec = clamp(music.fadeInSec, 0, 3, 0.5)
  const fadeOutSec = clamp(music.fadeOutSec, 0, 4, 1)
  const loop = music.loop !== false
  const licence = music.obtain?.licence || ''
  const commercialUse = music.obtain?.commercialUse || ''
  const attribution = music.obtain?.attribution || music.source || ''

  if (music.origin === 'external') {
    const url = music.obtain?.url || ''
    if (!url.startsWith('https://')) return { error: 'Music needs an https URL. Not substituting.' }
    if (!licence || !commercialUse || commercialUse === 'unknown') {
      return { error: 'Music needs a licence and known commercialUse. Not substituting.' }
    }
    return { enabled: true, kind: 'url', source: url, url, volume, fadeInSec, fadeOutSec, loop, licence, commercialUse, attribution }
  }
  if (music.origin === 'user-provided') {
    const name = music.originalFilename || ''
    if (!name || !files.has(name.toLowerCase())) {
      return { error: `Missing user music ${name || '(unnamed)'}. Not substituting.` }
    }
    if (!licence || !commercialUse || commercialUse === 'unknown') {
      return { error: 'User music needs a licence and known commercialUse. Not substituting.' }
    }
    return { enabled: true, kind: 'file', source: `user-file:${name}`, file: name, volume, fadeInSec, fadeOutSec, loop, licence, commercialUse, attribution }
  }
  return { error: 'Music origin is unknown. Not substituting.' }
}

function shotFrom(visual, kind, extra) {
  return {
    id: visual.id,
    kind,
    depicts: visual.depicts || '',
    durationSec: durationOf(visual),
    motion: motionOf(visual),
    licence: visual.obtain?.licence || '',
    attribution: visual.obtain?.attribution || '',
    ...extra,
  }
}

function durationOf(visual) {
  const n = Number(visual.durationSec)
  if (Number.isFinite(n) && n >= LIMITS.minDurationSec && n <= LIMITS.maxDurationSec) return n
  return 4
}

function motionOf(visual) {
  const allowed = new Set(['zoom-in', 'pan-left', 'pan-right', 'none'])
  if (allowed.has(visual.motion)) return visual.motion
  return null
}

function mediaKind(visual) {
  const type = String(visual.mediaType || '').toLowerCase()
  const name = String(visual.originalFilename || visual.obtain?.url || '').toLowerCase()
  if (type.startsWith('video') || /\.(mp4|mov|webm|mkv)$/.test(name)) return 'video'
  return 'image'
}

export function editSettings(dna) {
  const edit = dna?.edit && typeof dna.edit === 'object' ? dna.edit : {}
  const transition = edit.transition || 'fade'
  return {
    transition,
    preset: PRESETS[edit.preset] ? edit.preset : null,
    width: 1080,
    height: 1920,
    fps: 30,
  }
}

function clamp(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
