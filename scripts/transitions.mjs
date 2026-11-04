/**
 * Real transition catalogue. Every type maps to an FFmpeg xfade or a hard cut.
 * Unknown types are rejected. Nothing is substituted.
 */

export const LIMITS = {
  maxScenes: 120,
  minDurationSec: 0.5,
  maxDurationSec: 30,
  maxTotalSec: 180,
  maxTransitionSec: 1.2,
}

export const TRANSITIONS = {
  cut: { ffmpeg: null, advanced: false, label: 'Hard cut' },
  fade: { ffmpeg: 'fade', advanced: false, label: 'Crossfade' },
  'wipe-left': { ffmpeg: 'wipeleft', advanced: true, label: 'Wipe left' },
  'wipe-right': { ffmpeg: 'wiperight', advanced: true, label: 'Wipe right' },
  'wipe-up': { ffmpeg: 'wipeup', advanced: true, label: 'Wipe up' },
  'wipe-down': { ffmpeg: 'wipedown', advanced: true, label: 'Wipe down' },
  'whip-left': { ffmpeg: 'slideleft', advanced: true, label: 'Whip pan left' },
  'whip-right': { ffmpeg: 'slideright', advanced: true, label: 'Whip pan right' },
  zoom: { ffmpeg: 'zoomin', advanced: true, label: 'Zoom' },
  'zoom-blur': { ffmpeg: 'hblur', advanced: true, label: 'Horizontal blur' },
  glitch: { ffmpeg: 'pixelize', advanced: true, label: 'Pixelize' },
  flash: { ffmpeg: 'fadewhite', advanced: true, label: 'White flash' },
  'film-burn': { ffmpeg: 'fadewhite', advanced: true, label: 'White flash used as film burn' },
  'light-leak': { ffmpeg: 'radial', advanced: true, label: 'Radial light leak' },
}

export const PRESETS = {
  minimal: { label: 'Minimal clean edit', transition: 'cut' },
  documentary: { label: 'Documentary', transition: 'fade', durationSec: 0.4 },
  cinematic: { label: 'Cinematic', pattern: ['cut', 'cut', 'fade'] },
  'fast-social': { label: 'Fast-paced social edit', transition: 'fade', durationSec: 0.12 },
  gaming: { label: 'Gaming montage', pattern: ['cut', 'cut', 'cut', 'whip-left'] },
  luxury: { label: 'Luxury edit', transition: 'fade', durationSec: 0.6 },
  'high-energy': { label: 'High-energy montage', pattern: ['zoom', 'cut', 'flash', 'whip-right'] },
}

export function knownTransition(type) {
  return Object.prototype.hasOwnProperty.call(TRANSITIONS, type)
}

export function resolveTransition(explicit, preset, fallback, index) {
  if (explicit?.type) {
    if (!knownTransition(explicit.type)) {
      return { error: `Unsupported transition "${explicit.type}". Not substituting.` }
    }
    return normalize(explicit.type, explicit.durationSec, explicit)
  }
  if (preset && PRESETS[preset]) {
    const chosen = PRESETS[preset]
    const type = chosen.pattern ? chosen.pattern[index % chosen.pattern.length] : chosen.transition
    return normalize(type, explicit?.durationSec ?? chosen.durationSec, explicit)
  }
  const type = fallback === 'none' ? 'cut' : (fallback || 'fade')
  if (!knownTransition(type)) {
    return { error: `Unsupported edit.transition "${type}". Not substituting.` }
  }
  return normalize(type, null, null)
}

function normalize(type, durationSec, raw) {
  const spec = TRANSITIONS[type]
  if (type === 'cut') return { type, ffmpeg: null, durationSec: 0, advanced: false, direction: raw?.direction || '', intensity: 1 }
  const duration = clamp(durationSec, 0.08, LIMITS.maxTransitionSec, type === 'fade' ? 0.25 : 0.2)
  return {
    type,
    ffmpeg: spec.ffmpeg,
    durationSec: duration,
    advanced: spec.advanced,
    direction: raw?.direction || '',
    intensity: clamp(raw?.intensity, 0.2, 1, 1),
  }
}

export function clamp(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
