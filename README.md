# FRAMEWORK — Automated Video Production Studio

Create videos by pasting a FRAMEWORK DNA v1 package into a GitHub Actions workflow. Ubuntu workers validate the DNA, fetch external assets, render a real MP4 with FFmpeg, verify it with ffprobe, and publish a ZIP only on success.

**No website, no frontend, no API tokens, no local installation required.**

## Run a production on iPhone

1. Open the repository on GitHub.
2. Go to **Actions** → **Render production** → **Run workflow**.
3. Paste the complete FRAMEWORK DNA v1 block (including the wrapper markers) or raw JSON into the required **DNA** field.
4. Tap **Run workflow**.

When the run succeeds, a release is published containing the MP4 and a ZIP with the report. The job fails if validation, rendering, or ffprobe verification fails.

## DNA format

The workflow accepts either:

- A wrapped block starting with `---FRAMEWORK DNA` and ending with `---END FRAMEWORK DNA---`
- Raw JSON with `"schema": "framework-dna"` and `"schemaVersion": 1`

External visuals must include a licence and known commercialUse. User-provided media folders are not accepted.

## Tech

- GitHub Actions (`ubuntu-latest`)
- FFmpeg + ffprobe
- Pure Node validation and planning (`scripts/`)
