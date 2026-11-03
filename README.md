# FRAMEWORK — Automated Video Production Studio

Create videos by pasting a FRAMEWORK DNA v1 package into a GitHub Actions workflow. Ubuntu workers validate the DNA, fetch external assets, render a real MP4 with FFmpeg, verify it with ffprobe, and publish a ZIP only on success.

**No website, no frontend, no API tokens, no local installation required.**

## Run a production on iPhone

1. Open the repository on GitHub.
2. Go to **Actions** → **Render production** → **Run workflow**.
3. Paste one of the accepted DNA forms into the required **DNA** field.
4. Tap **Run workflow**.

When the run succeeds, a release is published containing the MP4 and a ZIP with the report. The job fails if validation, rendering, or ffprobe verification fails.

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
- `music` may be an external https file or a user-provided file. It needs a licence and known `commercialUse`. Missing or unlicensed music fails the job; nothing is substituted.
- `visuals[].durationSec` and `visuals[].motion` control pacing. Images are covered to 1080x1920, with a short fade and subtle movement.

Older DNA with only licensed visuals still renders, using four-second scenes and no music.

## Tech

- GitHub Actions (`ubuntu-latest`)
- FFmpeg + ffprobe
- Pure Node validation and planning (`scripts/`)
