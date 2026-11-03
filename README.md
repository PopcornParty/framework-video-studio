# FRAMEWORK — Automated Video Production Studio

Create videos by pasting a FRAMEWORK DNA v1 package into a GitHub Actions workflow. Ubuntu workers validate the DNA, fetch external assets, render a real MP4 with FFmpeg, verify it with ffprobe, and publish a ZIP only on success.

**No website, no frontend, no API tokens, no local installation required.**

## Run a production on iPhone

1. Open the repository on GitHub.
2. Go to **Actions** → **Render production** → **Run workflow**.
3. Paste one of the accepted DNA forms into the required **DNA** field.
4. If the DNA asks for user-provided music, paste an HTTPS link to your own licensed file in **music_url**.
5. Tap **Run workflow**.

When the run succeeds, the release contains `video.mp4` and a ZIP with only:

- `video.mp4`
- `subtitles.srt`
- `subtitles.ass`
- `report.txt`

Working files stay in a separate debug artifact. The job fails if validation, rendering, or ffprobe verification fails.

## DNA input formats

The workflow accepts any of these:

- A single-line compact code starting with `FW1:` (gzip + Base64URL)
- A wrapped block starting with `---FRAMEWORK DNA` and ending with `---END FRAMEWORK DNA---`
- Raw JSON with `"schema": "framework-dna"` and `"schemaVersion": 1`

Compact codes are decoded first. After that, the same schema, version, provenance, and asset checks run. A bad code never skips validation.

### Make a compact code

From a machine with Node:

```bash
node -e '
const { gzipSync } = require("zlib")
const fs = require("fs")
const text = fs.readFileSync("dna.json", "utf8")
process.stdout.write("FW1:" + gzipSync(Buffer.from(text)).toString("base64url"))
'
```

Paste the resulting one-line `FW1:` code into the workflow input.

## Subtitles and music

Optional DNA fields extend v1 without breaking older packages.

- `script.lines` become phrase-timed subtitles. Each line can set `startSec`, `endSec`, `sceneId`, and `highlight`.
- `subtitles.style` can be `clean`, `bold-box`, `outline`, or `karaoke`. Size, colour, outline, shadow, and margins are optional.
- The renderer writes `subtitles.srt` and `subtitles.ass`, then burns the ASS captions into the MP4.
- `music` is optional. There is no built-in soundtrack and no generated test tone.
- External music needs an `https` URL, a licence, and known `commercialUse`.
- User-provided music needs `originalFilename`, a licence, and known `commercialUse`. On GitHub Actions, paste that file's HTTPS link into `music_url`. The workflow downloads it only for that request. If the file is missing, the job fails. Nothing is substituted.
- `music.volume` defaults to `1`, which is a normalized audible background level. `0.7` is quieter and `1.2` is louder. Fade-in, fade-out, and looping stay on unless you change them.
- The report records the music source, licence, attribution, volume, and measured loudness.
- `visuals[].durationSec` and `visuals[].motion` control pacing. Images are covered to 1080x1920, with a short fade and subtle movement.

Older DNA with only licensed visuals still renders, using four-second scenes and no music.

## Tech

- GitHub Actions (`ubuntu-latest`)
- FFmpeg + ffprobe
- Pure Node validation and planning (`scripts/`)
