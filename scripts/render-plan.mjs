/** Decide what a cloud render may do. No network. No ffmpeg. No fake success. */

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
  for (const v of visuals) {
    if (v.origin === 'user-provided') {
      const name = v.originalFilename || ''
      if (!files.has(name.toLowerCase())) {
        if (v.required !== false) {
          errors.push(`Missing user asset ${v.id} (${name || 'unnamed'}). Upload it in the job folder. Not substituting.`)
        }
        continue
      }
      shots.push(shotFrom(v, 'file', { file: name }))
    } else if (v.origin === 'external') {
      const url = v.obtain?.url || ''
      if (!url.startsWith('https://')) {
        errors.push(`External visual ${v.id} needs an https URL.`)
        continue
      }
      if (!v.obtain?.licence || !v.obtain?.commercialUse || v.obtain.commercialUse === 'unknown') {
        errors.push(`External visual ${v.id} needs a licence and known commercialUse.`)
        continue
      }
      shots.push(shotFrom(v, 'url', { url }))
    } else {
      errors.push(`Visual ${v.id} has an unknown origin.`)
    }
  }
  if (!shots.length && !errors.length) {
    errors.push('No usable visuals after checks.')
  }

  const music = planMusic(dna, availableFiles)
  if (music.error) errors.push(music.error)

  return {
    ok: errors.length === 0,
    errors,
    shots,
    music: music.error ? null : music,
    edit: editSettings(dna),
  }
}

export function planMusic(dna, availableFiles = []) {
  const music = dna?.music
  if (!music || music.enabled === false) return { enabled: false }
  const files = new Set(availableFiles.map(f => String(f).toLowerCase()))
  const volume = clamp(music.volume, 0.05, 0.4, 0.18)
  const fadeInSec = clamp(music.fadeInSec, 0, 3, 0.4)
  const fadeOutSec = clamp(music.fadeOutSec, 0, 4, 0.8)
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
    return { enabled: true, kind: 'url', url, volume, fadeInSec, fadeOutSec, loop, licence, commercialUse, attribution }
  }
  if (music.origin === 'user-provided') {
    const name = music.originalFilename || ''
    if (!name || !files.has(name.toLowerCase())) {
      return { error: `Missing user music ${name || '(unnamed)'}. Not substituting.` }
    }
    if (!licence || !commercialUse || commercialUse === 'unknown') {
      return { error: 'User music needs a licence and known commercialUse. Not substituting.' }
    }
    return { enabled: true, kind: 'file', file: name, volume, fadeInSec, fadeOutSec, loop, licence, commercialUse, attribution }
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
    transition: visual.transition || null,
    licence: visual.obtain?.licence || '',
    attribution: visual.obtain?.attribution || '',
    ...extra,
  }
}

function durationOf(visual) {
  const n = Number(visual.durationSec)
  if (Number.isFinite(n) && n >= 0.8 && n <= 20) return n
  return 4
}

function motionOf(visual) {
  const allowed = new Set(['zoom-in', 'pan-left', 'pan-right', 'none'])
  if (allowed.has(visual.motion)) return visual.motion
  return null
}

export function editSettings(dna) {
  const edit = dna?.edit && typeof dna.edit === 'object' ? dna.edit : {}
  const transition = ['fade', 'none'].includes(edit.transition) ? edit.transition : 'fade'
  return {
    transition,
    transitionSec: transition === 'none' ? 0 : clamp(edit.transitionSec, 0.15, 0.8, 0.35),
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
