/** Download user music only when DNA asks for a user-provided file. Never substitutes. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const dnaPath = process.argv[2] || 'job/dna.json'
const mediaDir = process.argv[3] || 'job'
const musicUrl = process.env.MUSIC_URL || ''

if (!musicUrl) process.exit(0)

const dna = JSON.parse(await readFile(dnaPath, 'utf8'))
const music = dna.music
if (!music || music.enabled === false) {
  console.log('music_url ignored: DNA does not request music.')
  process.exit(0)
}
if (music.origin !== 'user-provided') {
  console.error('music_url is only for user-provided music. DNA already names another source. Not substituting.')
  process.exit(1)
}
if (!musicUrl.startsWith('https://')) {
  console.error('music_url must be an https URL. Not substituting.')
  process.exit(1)
}

const name = path.basename(music.originalFilename || 'user-music')
if (!name || name === '.' || name === '..') {
  console.error('User music filename is missing. Not substituting.')
  process.exit(1)
}

const res = await fetch(musicUrl, {
  headers: { 'User-Agent': 'FRAMEWORKVideoStudio/0.1 (https://github.com/PopcornParty/framework-video-studio)' },
})
if (!res.ok) {
  console.error(`Could not fetch user music: HTTP ${res.status}. Not substituting.`)
  process.exit(1)
}
await mkdir(mediaDir, { recursive: true })
await writeFile(path.join(mediaDir, name), Buffer.from(await res.arrayBuffer()))
console.log(`Fetched user music as ${name}`)
