/** Cloud render. Fetches only planned URLs. Writes a real MP4 or fails. */
import { mkdir, writeFile, readdir, readFile, copyFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { planJob } from './render-plan.mjs'
import { buildCues, toAss, toSrt, validateCues } from './subtitles.mjs'

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

  const images = []
  for (const shot of plan.shots) {
    const dest = path.join(outDir, `${shot.id}.img`)
    if (shot.kind === 'url') {
      const res = await fetch(shot.url, {
        headers: {
          'User-Agent': 'FRAMEWORKVideoStudio/0.1 (https://github.com/PopcornParty/framework-video-studio)',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      })
      if (!res.ok) return fail(outDir, `Could not fetch ${shot.id}: HTTP ${res.status} ${shot.url}`)
      await writeFile(dest, Buffer.from(await res.arrayBuffer()))
    } else {
      await copyFile(path.join(mediaDir, shot.file), dest)
    }
    images.push(dest)
  }

  const scenes = []
  for (let i = 0; i < plan.shots.length; i++) {
    const shot = plan.shots[i]
    const frames = Math.round(shot.durationSec * plan.edit.fps)
    const scene = path.join(outDir, `${shot.id}.mp4`)
    await renderScene(images[i], scene, frames, motionFor(shot, i), plan.edit)
    scenes.push(scene)
  }

  const joined = path.join(outDir, 'joined.mp4')
  await joinScenes(scenes, plan.shots.map(s => s.durationSec), plan.edit, joined)

  const probeJoined = await probe(joined)
  const { cues, settings } = buildCues(dna, plan.shots, plan.edit.transitionSec)
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
      const res = await fetch(plan.music.url, {
        headers: { 'User-Agent': 'FRAMEWORKVideoStudio/0.1 (https://github.com/PopcornParty/framework-video-studio)' },
      })
      if (!res.ok) return fail(outDir, `Could not fetch music: HTTP ${res.status}. Not substituting.`)
      await writeFile(musicPath, Buffer.from(await res.arrayBuffer()))
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
    `shots=${plan.shots.map(s => s.id).join(',')}`,
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

async function renderScene(image, out, frames, motion, edit) {
  const zoom = motion === 'none' ? '1' : motion === 'zoom-in' ? 'min(1.10,1+0.0009*on)' : '1.05'
  const x = motion === 'pan-right'
    ? 'iw/2-(iw/zoom/2)+on*0.45'
    : motion === 'pan-left'
      ? 'iw/2-(iw/zoom/2)-on*0.45'
      : 'iw/2-(iw/zoom/2)'
  await run('ffmpeg', [
    '-y', '-loop', '1', '-i', image,
    '-vf', `scale=${edit.width}:${edit.height}:force_original_aspect_ratio=increase,crop=${edit.width}:${edit.height},zoompan=z='${zoom}':x='${x}':y='ih/2-(ih/zoom/2)':d=${frames}:s=${edit.width}x${edit.height}:fps=${edit.fps}`,
    '-frames:v', String(frames),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(edit.fps),
    out,
  ])
}

async function joinScenes(files, durations, edit, out) {
  if (files.length === 1) {
    await copyFile(files[0], out)
    return
  }
  const trans = edit.transition === 'none' ? 0 : edit.transitionSec
  if (trans <= 0) {
    const list = files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
    const listPath = path.join(path.dirname(out), 'concat.txt')
    await writeFile(listPath, list)
    await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', out])
    return
  }
  const args = ['-y']
  for (const file of files) args.push('-i', file)
  let offset = durations[0] - trans
  let filter = `[0:v][1:v]xfade=transition=fade:duration=${trans}:offset=${offset.toFixed(3)}[x1]`
  for (let i = 2; i < files.length; i++) {
    offset += durations[i - 1] - trans
    filter += `;[x${i - 1}][${i}:v]xfade=transition=fade:duration=${trans}:offset=${offset.toFixed(3)}[x${i}]`
  }
  args.push('-filter_complex', filter, '-map', `[x${files.length - 1}]`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(edit.fps), out)
  await run('ffmpeg', args)
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
