# Cloud render jobs

Optional. Use this only when a video needs your own files.

1. Create a folder here, for example `jobs/my-video/`.
2. Put `dna.json` in that folder.
3. Put the original files ChatGPT selected in `jobs/my-video/media/`.
4. Upload the folder with the GitHub website while logged in. Do not put a token in the app.
5. Run the Render production workflow and set `job_path` to `jobs/my-video`.

Required files that are missing stop the render. External images are not used as substitutes.
