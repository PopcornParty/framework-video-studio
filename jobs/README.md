# Cloud render jobs

The GitHub Actions render workflow accepts DNA only.

1. Open the repository on GitHub.
2. Go to Actions → Render production → Run workflow.
3. Paste an `FW1:` compact code, a FRAMEWORK DNA v1 block, or raw JSON into the required DNA field.
4. Tap Run workflow.

GitHub-hosted Ubuntu workers decode compact codes if present, validate the DNA, fetch external assets listed in the package, render a real MP4 with FFmpeg, verify it with ffprobe, package a ZIP, and publish a release only if every step succeeds.

User-provided media folders are not accepted. DNA that requires local files will fail validation rather than invent footage.
