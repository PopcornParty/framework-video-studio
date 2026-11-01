# FRAMEWORK — Automated Video Production Studio

A mobile-friendly video production application that creates storyboards from written prompts using a local media library of licensed stock footage, then renders real MP4 videos in the browser.

**No external AI APIs. No paid services. Everything runs locally.**

## Features (in progress)

- Prompt interpretation engine (rule-based + synonym dictionaries)
- Media library with IndexedDB persistence
- Storyboard generation and editing
- Browser-based rendering with FFmpeg.wasm
- PWA support for iPhone Home Screen
- GitHub Pages deployment

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- IndexedDB (via idb)
- FFmpeg.wasm
- React Router
- vite-plugin-pwa

## Development

```bash
npm install
npm run dev
```

## Deployment

Deployed via GitHub Actions to GitHub Pages.
