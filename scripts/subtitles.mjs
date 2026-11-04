/**
 * Subtitle planning for FRAMEWORK Shorts.
 * Data only. No network. No ffmpeg.
 *
 * Produces phrase-timed cues from the script, then SRT and ASS.
 * Timing is automatic unless a line supplies startSec/endSec.
 */

export const DEFAULT_SUBTITLES = {
  enabled: true,
  style: 'clean',
  font: 'Liberation Sans',
  size: 54,
  colour: '#FFFFFF',
  outline: 3,
  shadow: 1,
  background: true,
  highlightColour: '#FFE14A',
  animation: 'fade',
  marginBottom: 280,
  marginSide: 90,
  maxChars: 28,
  maxLines: 2,
}

const STYLE_PRESETS = {
  clean: { background: true, outline: 3, shadow: 1, animation: 'fade' },
  'bold-box': { background: true, outline: 0, shadow: 0, animation: 'fade', borderStyle: 3 },
  outline: { background: false, outline: 4, shadow: 1, animation: 'fade' },
  karaoke: { background: true, outline: 3, shadow: 1, animation: 'karaoke' },
}

export function scriptLines(dna) {
  const lines = dna?.script?.lines
  if (!Array.isArray(lines)) return []
  return lines
    .filter(line => line && typeof line.text === 'string' && line.text.trim())
    .map(line => ({
      id: line.id || '',
      text: line.text.trim(),
      startSec: numberOrNull(line.startSec),
      endSec: numberOrNull(line.endSec),
      sceneId: line.sceneId || null,
      sceneIndex: Number.isInteger(line.sceneIndex) ? line.sceneIndex : null,
      highlight: Array.isArray(line.highlight) ? line.highlight.filter(w => typeof w === 'string' && w) : [],
    }))
}

export function subtitleSettings(dna) {
  const raw = dna?.subtitles && typeof dna.subtitles === 'object' ? dna.subtitles : {}
  const preset = STYLE_PRESETS[raw.style] || STYLE_PRESETS.clean
  return {
    ...DEFAULT_SUBTITLES,
    ...preset,
    ...raw,
    enabled: raw.enabled !== false,
    style: STYLE_PRESETS[raw.style] ? raw.style : 'clean',
    size: clamp(raw.size, 36, 72, DEFAULT_SUBTITLES.size),
    outline: clamp(raw.outline, 0, 8, preset.outline ?? DEFAULT_SUBTITLES.outline),
    shadow: clamp(raw.shadow, 0, 6, preset.shadow ?? DEFAULT_SUBTITLES.shadow),
    marginBottom: clamp(raw.marginBottom, 160, 420, DEFAULT_SUBTITLES.marginBottom),
  }
}

/** Keep punctuation attached to the word it belongs to. */
export function tokenize(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean)
}

export function phrasesOf(text, size = 3) {
  const tokens = tokenize(text)
  const phrases = []
  for (let i = 0; i < tokens.length; i += size) {
    phrases.push(tokens.slice(i, i + size).join(' '))
  }
  return phrases.length ? phrases : [String(text || '').trim()]
}

export function wrapCaption(text, maxChars = 28, maxLines = 2) {
  const words = tokenize(text)
  const lines = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  if (lines.length <= maxLines) return lines
  // Keep the caption readable: first lines stay, overflow becomes a later cue.
  return lines.slice(0, maxLines)
}

export function splitLongCaption(text, maxChars = 28, maxLines = 2) {
  const words = tokenize(text)
  const chunks = []
  let current = []
  let length = 0
  for (const word of words) {
    const add = current.length ? word.length + 1 : word.length
    const linesIfAdded = Math.ceil((length + add) / maxChars)
    if (current.length && linesIfAdded > maxLines) {
      chunks.push(current.join(' '))
      current = [word]
      length = word.length
    } else {
      current.push(word)
      length += add
    }
  }
  if (current.length) chunks.push(current.join(' '))
  return chunks.length ? chunks : [String(text || '').trim()]
}

export function sceneWindows(shots, transitionSec = 0) {
  const windows = []
  let start = 0
  shots.forEach((shot, index) => {
    const duration = positive(shot.durationSec, 4)
    windows.push({
      id: shot.id,
      index,
      start,
      end: start + duration,
      duration,
    })
    start += duration - (index < shots.length - 1 ? overlapOf(shot, transitionSec) : 0)
  })
  const total = windows.length ? windows[windows.length - 1].end : 0
  return { windows, total }
}

export function buildCues(dna, shots, transitionSec = 0) {
  const settings = subtitleSettings(dna)
  if (!settings.enabled) return { cues: [], settings, total: sceneWindows(shots, transitionSec).total }
  const lines = scriptLines(dna)
  const { windows, total } = sceneWindows(shots, transitionSec)
  if (!lines.length || total <= 0) return { cues: [], settings, total }

  const lineWindows = allocateLineWindows(lines, windows, total)
  const cues = []
  for (const line of lineWindows) {
    const chunks = splitLongCaption(line.text, settings.maxChars, settings.maxLines)
    const span = Math.max(0.4, line.end - line.start)
    const weights = chunks.map(chunk => Math.max(1, tokenize(chunk).length))
    const weightSum = weights.reduce((sum, n) => sum + n, 0)
    let cursor = line.start
    chunks.forEach((chunk, index) => {
      const phrases = phrasesOf(chunk, settings.animation === 'karaoke' ? 2 : 3)
      const chunkDur = span * (weights[index] / weightSum)
      const phraseWeight = phrases.map(p => Math.max(1, tokenize(p).length))
      const phraseSum = phraseWeight.reduce((sum, n) => sum + n, 0)
      phrases.forEach((phrase, phraseIndex) => {
        const dur = Math.max(0.35, chunkDur * (phraseWeight[phraseIndex] / phraseSum))
        const start = cursor
        const end = Math.min(line.end, total, cursor + dur)
        cues.push({
          id: `${line.id || 'line'}-${index}-${phraseIndex}`,
          text: phrase,
          start: round3(start),
          end: round3(Math.max(start + 0.3, end)),
          highlight: line.highlight,
          sceneId: line.sceneId,
        })
        cursor += dur
      })
    })
  }
  return { cues: cues.filter(cue => cue.end > cue.start), settings, total }
}

export function validateCues(cues, duration) {
  const errors = []
  for (const cue of cues) {
    if (cue.start < -0.05) errors.push(`Cue ${cue.id} starts before the video.`)
    if (cue.end > duration + 0.05) errors.push(`Cue ${cue.id} ends after the video.`)
    if (cue.end <= cue.start) errors.push(`Cue ${cue.id} has no duration.`)
    if (!cue.text.trim()) errors.push(`Cue ${cue.id} is empty.`)
  }
  return errors
}

export function toSrt(cues) {
  return cues.map((cue, index) => {
    const text = wrapCaption(cue.text).join('\n')
    return `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${text}\n`
  }).join('\n')
}

export function toAss(cues, settings = DEFAULT_SUBTITLES) {
  const style = { ...DEFAULT_SUBTITLES, ...settings }
  const primary = assColour(style.colour || '#FFFFFF')
  const highlight = assColour(style.highlightColour || '#FFE14A')
  const back = style.background ? '&H64000000' : '&H00000000'
  const borderStyle = style.borderStyle || (style.background ? 3 : 1)
  const outline = style.background && borderStyle === 3 ? 8 : style.outline
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${style.font},${style.size},${primary},${highlight},&H00000000,${back},-1,0,0,0,100,100,0,0,${borderStyle},${outline},${style.shadow},2,${style.marginSide},${style.marginSide},${style.marginBottom},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ]
  const events = cues.map(cue => {
    const text = assText(cue, style)
    return `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Default,,0,0,0,,${text}`
  })
  return [...header, ...events, ''].join('\n')
}

function allocateLineWindows(lines, windows, total) {
  const automatic = lines.filter(line => line.startSec == null || line.endSec == null)
  const weights = automatic.map(line => Math.max(1, tokenize(line.text).length))
  const weightSum = weights.reduce((sum, n) => sum + n, 0) || 1
  let cursor = 0.12
  let autoIndex = 0
  return lines.map(line => {
    const scene = sceneFor(line, windows)
    const boundStart = scene ? scene.start : 0
    const boundEnd = scene ? scene.end : total
    if (line.startSec != null && line.endSec != null) {
      return {
        ...line,
        start: clamp(line.startSec, boundStart, boundEnd - 0.3),
        end: clamp(line.endSec, boundStart + 0.3, boundEnd),
      }
    }
    const share = (boundEnd - boundStart - 0.2) * (weights[autoIndex] / weightSum)
    autoIndex += 1
    const start = scene ? Math.max(boundStart + 0.08, cursor) : cursor
    const end = Math.min(boundEnd - 0.05, start + Math.max(0.8, share))
    cursor = end
    return { ...line, start, end }
  })
}

function sceneFor(line, windows) {
  if (line.sceneId) return windows.find(window => window.id === line.sceneId) || null
  if (line.sceneIndex != null) return windows[line.sceneIndex] || null
  return null
}

function assText(cue, style) {
  const wrapped = wrapCaption(cue.text, style.maxChars, style.maxLines)
    .map(line => highlightWords(line, cue.highlight, style.highlightColour))
    .join('\\N')
  if (style.animation === 'karaoke') return `{\\fad(80,80)}${karaoke(cue.text, cue.end - cue.start)}`
  if (style.animation === 'none') return wrapped
  return `{\\fad(140,140)}${wrapped}`
}

function karaoke(text, duration) {
  const words = tokenize(text)
  const each = Math.max(8, Math.round((duration * 100) / Math.max(1, words.length)))
  return words.map(word => `{\\k${each}}${escapeAss(word)}`).join(' ')
}

function highlightWords(text, words, colour) {
  if (!words?.length) return escapeAss(text).replace(/\\N/g, '\\N')
  let out = escapeAss(text)
  const accent = assColour(colour || '#FFE14A')
  for (const word of words) {
    const safe = escapeAss(word)
    if (!safe) continue
    out = out.replaceAll(safe, `{\\c${accent}\\b1}${safe}{\\r}`)
  }
  return out
}

function escapeAss(text) {
  return String(text || '').replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}')
}

function assColour(hex) {
  const clean = String(hex || '#FFFFFF').replace('#', '')
  const value = clean.length === 3
    ? clean.split('').map(ch => ch + ch).join('')
    : clean.padEnd(6, '0').slice(0, 6)
  const r = value.slice(0, 2)
  const g = value.slice(2, 4)
  const b = value.slice(4, 6)
  return `&H00${b}${g}${r}`.toUpperCase()
}

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const milli = ms % 1000
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(milli).padStart(3, '0')}`
}

function assTime(seconds) {
  const cs = Math.max(0, Math.round(seconds * 100))
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const centi = cs % 100
  return `${h}:${pad(m)}:${pad(s)}.${String(centi).padStart(2, '0')}`
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function clamp(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function positive(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null
}

function overlapOf(shot, fallback) {
  const n = Number(shot?.transition?.durationSec)
  return Number.isFinite(n) ? n : fallback
}

function round3(n) {
  return Math.round(n * 1000) / 1000
}
