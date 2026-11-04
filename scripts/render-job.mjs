/** Cloud render. Fetches only planned URLs. Writes a real MP4 or fails. */
import { mkdir, writeFile, readdir, readFile, copyFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { planJob } from './render-plan.mjs'
import { buildCues, toAss, toSrt, validateCues } from './subtitles.mjs'
import { downloadShots, fetchWithRetry } from './fetch-asset.mjs'

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    p.stdout.on('data', d => { out += d })
    p.stderr.on('data', d => { err += d })
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error((err || out || `${cmd} failed`).slice(-2000))))
  })
}

async function fail(outDir, message) {
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, 'report.txt'), `FAILED\n${message}\n`)
  console.error(message)
  process.exit(1)
}

async function main() {
  const dnaPath = process.argv[2]
  const mediaDir = process.argv[3] || ''
  const outDir = process.argv[4] || 'render-out'
  if (!dnaPath) {
    console.error('Usage: node scripts/render-job.mjs <dna.json> [mediaDir] [outDir]')
    process.exit(1)
  }
  const dna = JSON.parse(await readFile(dnaPath, 'utf8'))
  const files = mediaDir ? (await readdir(mediaDir).catch(() => [])) : []
  const plan = planJob(dna, files)
  await mkdir(outDir, { recursive: true })
  if (!plan.ok) return fail(outDir, plan.errors.join('\n'))

  const cache = new Map()
  const downloaded = await downloadShots(plan.shots, { cache })
  const assets = []
  for (let i = 0; i < downloaded.results.length; i++) {
    const item = downloaded.results[i]
    const shot = item.shot
    const dest = path.join(outDir, `${safe(shot.id)}-${i}.media`)
    if (shot.kind === 'url') {
      if (!item.ok) return fail(outDir, item.error || `Could not fetch ${shot.id}: HTTP ${item.status || 'unknown'} ${shot.url}`)
      await writeFile(dest, item.bytes)
    } else {
      await copyFile(path.join(mediaDir, shot.file), dest)
    }
    assets.push(dest)
    await progress(outDir, `fetched ${i + 1}/${plan.shots.length}${item.cached ? ' cached' : ''}`)
  }

  const scenes = []
  for (let i = 0; i < plan.shots.length; i++) {
    const shot = plan.shots[i]
    const frames = Math.max(1, Math.round(shot.durationSec * plan.edit.fps))
    const scene = path.join(outDir, `${safe(shot.id)}-${i}.mp4`)
    if (shot.media === 'video') await renderVideo(assets[i], scene, shot, plan.edit)
    else await renderScene(assets[i], scene, frames, motionFor(shot, i), plan.edit, shot)
    scenes.push(scene)
    await progress(outDir, `rendered scene ${i + 1}/${plan.shots.length}`)
  }

  const joined = path.join(outDir, 'joined.mp4')
  await joinScenes(scenes, plan.shots, plan.edit, joined, outDir)

  const probeJoined = await probe(joined)
  const { cues, settings } = buildCues(dna, plan.shots, 0)
  const timingErrors = validateCues(cues, probeJoined.duration)
  if (timingErrors.length) return fail(outDir, timingErrors.join('\n'))
  const srt = toSrt(cues)
  const ass = toAss(cues, settings)
  await writeFile(path.join(outDir, 'subtitles.srt'), srt)
  await writeFile(path.join(outDir, 'subtitles.ass'), ass)

  const burned = path.join(outDir, 'burned.mp4')
  if (cues.length) {
    await burnSubtitles(joined, path.join(outDir, 'subtitles.ass'), burned)
  } else {
    await copyFile(joined, burned)
  }

  let musicPath = ''
  if (plan.music?.enabled) {
    musicPath = path.join(outDir, 'music.bin')
    if (plan.music.kind === 'url') {
      const fetched = await fetchWithRetry(plan.music.url, { sceneId: 'music', cache })
      if (!fetched.ok) return fail(outDir, `${fetched.error}. Not substituting.`)
      await writeFile(musicPath, fetched.bytes)
    } else {
      await copyFile(path.join(mediaDir, plan.music.file), musicPath)
    }
  }

  const mp4 = path.join(outDir, 'video.mp4')
  if (plan.music?.enabled) {
    await mixMusic(burned, musicPath, mp4, probeJoined.duration, plan.music)
  } else {
    await copyFile(burned, mp4)
  }

  const checked = await probe(mp4)
  if (!Number.isFinite(checked.duration) || checked.duration <= 0) {
    return fail(outDir, 'ffprobe found no playable duration. Not reporting success.')
  }
  if (plan.music?.enabled && !checked.hasAudio) {
    return fail(outDir, 'Music was requested but the MP4 has no audio stream.')
  }
  if (cues.length && validateCues(cues, checked.duration).length) {
    return fail(outDir, 'Subtitle timing does not fit the final video.')
  }

  const loudness = plan.music?.enabled ? await measureLoudness(mp4) : { mean: null, max: null }
  if (plan.music?.enabled && (loudness.mean == null || loudness.mean < -32)) {
    return fail(outDir, `Music is present but too quiet (mean ${loudness.mean} dB). Not reporting success.`)
  }

  const report = [
    'OK',
    `duration=${checked.duration}`,
    `transitions=${plan.shots.slice(0, -1).map(s => s.transition.type).join(',')}`,
    `subtitles=${cues.length}`,
    `music=${plan.music?.enabled ? 'yes' : 'no'}`,
    `music_source=${plan.music?.source || ''}`,
    `music_licence=${plan.music?.licence || ''}`,
    `music_attribution=${plan.music?.attribution || ''}`,
    `music_volume=${plan.music?.enabled ? plan.music.volume : ''}`,
    `music_mean_db=${loudness.mean ?? ''}`,
    `music_max_db=${loudness.max ?? ''}`,
    ...plan.shots.map(s => `visual ${s.id} licence=${s.licence} attribution=${s.attribution}`),
  ].join('\n') + '\n'
  await writeFile(path.join(outDir, 'report.txt'), report)
  console.log(`Rendered ${mp4} (${checked.duration}s, ${cues.length} cues)`)
}

function motionFor(shot, index) {
  if (shot.motion) return shot.motion
  return ['zoom-in', 'pan-right', 'pan-left'][index % 3]
}

async function renderScene(image, out, frames, motion, edit, shot) {
  const zoom = motion === 'none' ? '1' : motion === 'zoom-in' ? 'min(1.10,1+0.0009*on)' : '1.05'
  const x = motion === 'pan-right'
    ? 'iw/2-(iw/zoom/2)+on*0.45'
    : motion === 'pan-left'
      ? 'iw/2-(iw/zoom/2)-on*0.45'
      : 'iw/2-(iw/zoom/2)'
  const focus = cropFocus(shot?.crop)
  await run('ffmpeg', [
    '-y', '-loop', '1', '-i', image,
    '-vf', `scale=${edit.width}:${edit.height}:force_original_aspect_ratio=increase,crop=${edit.width}:${edit.height}:${focus.x}:${focus.y},zoompan=z='${zoom}':x='${x}':y='ih/2-(ih/zoom/2)':d=${frames}:s=${edit.width}x${edit.height}:fps=${edit.fps}`,
    '-frames:v', String(frames),
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(edit.fps),
    out,
  ])
}

async function renderVideo(file, out, shot, edit) {
  const focus = cropFocus(shot.crop)
  const speed = shot.speed || 1
  await run('ffmpeg', [
    '-y', '-i', file,
    '-vf', `scale=${edit.width}:${edit.height}:force_original_aspect_ratio=increase,crop=${edit.width}:${edit.height}:${focus.x}:${focus.y},setpts=${(1 / speed).toFixed(4)}*PTS`,
    '-t', String(shot.durationSec),
    '-an',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(edit.fps),
    out,
  ])
}

async function joinScenes(files, shots, edit, out, outDir) {
  if (files.length === 1) {
    await copyFile(files[0], out)
    return
  }
  let current = files[0]
  let currentDuration = shots[0].durationSec
  for (let i = 1; i < files.length; i++) {
    const transition = shots[i - 1].transition
    const nextOut = path.join(outDir, `join-${i}.mp4`)
    if (!transition || transition.type === 'cut' || transition.durationSec <= 0) {
      await concatPair(current, files[i], nextOut)
      currentDuration += shots[i].durationSec
    } else {
      const offset = Math.max(0, currentDuration - transition.durationSec)
      await run('ffmpeg', [
        '-y', '-i', current, '-i', files[i],
        '-filter_complex', `[0:v][1:v]xfade=transition=${transition.ffmpeg}:duration=${transition.durationSec}:offset=${offset.toFixed(3)}[v]`,
        '-map', '[v]',
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(edit.fps),
        nextOut,
      ])
      currentDuration = offset + shots[i].durationSec
    }
    current = nextOut
    await progress(outDir, `joined ${i}/${files.length - 1} (${transition?.type || 'cut'})`)
  }
  await copyFile(current, out)
}

async function concatPair(a, b, out) {
  const list = [a, b].map(file => `file '${path.resolve(file).replace(/'/g, "'\\''")}'`).join('\n') + '\n'
  const listPath = `${out}.txt`
  await writeFile(listPath, list)
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', out])
}

function cropFocus(crop) {
  if (!crop) return { x: '(in_w-out_w)/2', y: '(in_h-out_h)/2' }
  const x = Number.isFinite(crop.x) ? Math.min(1, Math.max(0, crop.x)) : 0.5
  const y = Number.isFinite(crop.y) ? Math.min(1, Math.max(0, crop.y)) : 0.5
  return { x: `(in_w-out_w)*${x}`, y: `(in_h-out_h)*${y}` }
}

function safe(id) {
  return String(id || 'scene').replace(/[^A-Za-z0-9_-]/g, '_')
}

async function progress(outDir, message) {
  console.log(message)
  await writeFile(path.join(outDir, 'progress.txt'), `${message}\n`).catch(() => {})
}

async function burnSubtitles(video, assPath, out) {
  const escaped = assPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'")
  const fonts = '/usr/share/fonts/truetype/liberation2'
  await run('ffmpeg', [
    '-y', '-i', video,
    '-vf', `ass='${escaped}':fontsdir='${fonts}'`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    out,
  ])
}

async function mixMusic(video, music, out, duration, settings) {
  const fadeOutStart = Math.max(0, duration - settings.fadeOutSec)
  // Normalize first so a quiet or hot source lands at a phone-audible level.
  // volume 1 is that normalized level. It is not a hidden test tone.
  await run('ffmpeg', [
    '-y', '-i', video, '-stream_loop', '-1', '-i', music,
    '-filter_complex', `[1:a]aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${duration},asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=7,volume=${settings.volume},afade=t=in:st=0:d=${settings.fadeInSec},afade=t=out:st=${fadeOutStart}:d=${settings.fadeOutSec},alimiter=limit=0.95[a]`,
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
    out,
  ])
}

async function measureLoudness(file) {
  const err = await new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] })
    let text = ''
    p.stderr.on('data', d => { text += d })
    p.on('close', code => code === 0 ? resolve(text) : reject(new Error('volumedetect failed')))
  })
  const mean = err.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/)
  const max = err.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/)
  return {
    mean: mean ? Number(mean[1]) : null,
    max: max ? Number(max[1]) : null,
  }
}

async function probe(file) {
  const duration = Number((await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ])).trim())
  const streams = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file,
  ])
  return { duration, hasAudio: streams.split('\n').some(line => line.trim() === 'audio') }
}

main().catch(async err => {
  const outDir = process.argv[4] || 'render-out'
  const message = err instanceof Error ? err.message : String(err)
  await mkdir(outDir, { recursive: true }).catch(() => {})
  await writeFile(path.join(outDir, 'report.txt'), `FAILED\n${message}\n`).catch(() => {})
  console.error(message)
  process.exit(1)
})
