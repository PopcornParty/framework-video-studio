/** Package a finished render. The normal ZIP is only the four deliverables. */
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

export const DELIVERABLES = ['video.mp4', 'subtitles.srt', 'subtitles.ass', 'report.txt']

export async function stageDeliverables(renderDir, distDir) {
  await mkdir(distDir, { recursive: true })
  const staged = []
  for (const name of DELIVERABLES) {
    const src = path.join(renderDir, name)
    if (!(await exists(src))) continue
    await copyFile(src, path.join(distDir, name))
    staged.push(name)
  }
  return staged
}

export async function stageDebug(renderDir, debugDir) {
  await mkdir(debugDir, { recursive: true })
  const names = await readdir(renderDir)
  const staged = []
  for (const name of names) {
    if (DELIVERABLES.includes(name)) continue
    const src = path.join(renderDir, name)
    if (!(await stat(src)).isFile()) continue
    await copyFile(src, path.join(debugDir, name))
    staged.push(name)
  }
  return staged
}

export function zipDir(dir, zipPath) {
  return new Promise((resolve, reject) => {
    const p = spawn('python3', ['-c', `
import os, sys, zipfile
root, dest = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in sorted(os.listdir(root)):
        path = os.path.join(root, name)
        if os.path.isfile(path):
            z.write(path, name)
`, dir, zipPath], { stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    p.stderr.on('data', d => { err += d })
    p.on('close', code => code === 0 ? resolve() : reject(new Error(err || 'zip failed')))
  })
}

async function exists(file) {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

async function main() {
  const renderDir = process.argv[2] || 'render-out'
  const root = process.argv[3] || '.'
  const dist = path.join(root, 'dist')
  const debug = path.join(root, 'debug')
  const staged = await stageDeliverables(renderDir, dist)
  if (!staged.includes('video.mp4') || !staged.includes('report.txt')) {
    console.error('Refusing to package: video.mp4 and report.txt are required.')
    process.exit(1)
  }
  await zipDir(dist, path.join(root, 'framework-render.zip'))
  const debugFiles = await stageDebug(renderDir, debug)
  if (debugFiles.length) await zipDir(debug, path.join(root, 'framework-debug.zip'))
  console.log(`packaged ${staged.join(', ')}`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
