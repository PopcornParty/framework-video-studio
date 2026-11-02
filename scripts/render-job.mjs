/** Cloud render. Fetches only planned URLs. Writes a real MP4 or fails. */
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { planJob } from './render-plan.mjs'

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

  const inputs = []
  for (const shot of plan.shots) {
    const dest = path.join(outDir, `${shot.id}.img`)
    if (shot.kind === 'url') {
      const res = await fetch(shot.url, {
        headers: { 'User-Agent': 'FRAMEWORK-Video-Studio/0.1 (GitHub Actions render; contact: popcornparty)' },
      })
      if (!res.ok) return fail(outDir, `Could not fetch ${shot.id}: HTTP ${res.status}`)
      await writeFile(dest, Buffer.from(await res.arrayBuffer()))
    } else {
      const src = path.join(mediaDir, shot.file)
      await writeFile(dest, await readFile(src))
    }
    inputs.push(dest)
  }

  const args = []
  for (const f of inputs) args.push('-loop', '1', '-t', '3', '-i', f)
  const filters = inputs.map((_, i) =>
    `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`
  ).join(';')
  const concat = inputs.map((_, i) => `[v${i}]`).join('') + `concat=n=${inputs.length}:v=1:a=0[out]`
  const mp4 = path.join(outDir, 'video.mp4')
  await run('ffmpeg', [
    '-y', ...args,
    '-filter_complex', `${filters};${concat}`,
    '-map', '[out]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30',
    mp4,
  ])
  const probe = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4,
  ])
  const duration = Number(probe.trim())
  if (!Number.isFinite(duration) || duration <= 0) {
    return fail(outDir, 'ffprobe found no playable duration. Not reporting success.')
  }
  await writeFile(path.join(outDir, 'report.txt'), `OK\nduration=${duration}\nshots=${plan.shots.map(s => s.id).join(',')}\n`)
  console.log(`Rendered ${mp4} (${duration}s)`)
}

main().catch(async err => {
  const outDir = process.argv[4] || 'render-out'
  const message = err instanceof Error ? err.message : String(err)
  await mkdir(outDir, { recursive: true }).catch(() => {})
  await writeFile(path.join(outDir, 'report.txt'), `FAILED\n${message}\n`).catch(() => {})
  console.error(message)
  process.exit(1)
})
