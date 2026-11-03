# Cloud render jobs

The GitHub Actions render workflow accepts DNA, plus an optional music URL.

1. Open the repository on GitHub.
2. Go to Actions → Render production → Run workflow.
3. Paste an `FW1:` compact code, a FRAMEWORK DNA v1 block, or raw JSON into the required DNA field.
4. If the DNA requests user-provided music, paste an HTTPS link to your own licensed file into `music_url`.
5. Tap Run workflow.

There is no built-in soundtrack. A missing or unlicensed music request fails rather than substituting a track.

The release ZIP contains only `video.mp4`, `subtitles.srt`, `subtitles.ass`, and `report.txt`.
