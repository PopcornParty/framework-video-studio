import { useState } from 'react'

const ACTIONS_URL = 'https://github.com/PopcornParty/framework-video-studio/actions/workflows/render.yml'

export default function CloudRender() {
  const [dna, setDna] = useState('')
  const [copied, setCopied] = useState(false)

  async function copyDna() {
    await navigator.clipboard.writeText(dna)
    setCopied(true)
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold">Cloud render</h2>
      <p className="text-xs text-gray-500">
        Paste DNA here, copy it, then run the GitHub Action while you are logged in. This page has no access token. The Action renders a real MP4 and you download the ZIP from the run page.
      </p>
      <textarea
        className="w-full h-48 bg-dark-card border border-dark-border rounded-lg p-3 text-xs font-mono"
        placeholder="Paste FRAMEWORK DNA v1"
        value={dna}
        onChange={e => setDna(e.target.value)}
      />
      <button onClick={copyDna} disabled={!dna.trim()} className="w-full border border-dark-border py-3 rounded-lg text-sm disabled:opacity-50">
        {copied ? 'Copied' : 'Copy DNA'}
      </button>
      <a href={ACTIONS_URL} className="block w-full bg-blue-600 text-white text-center py-3 rounded-lg text-sm">
        Open Render workflow
      </a>
      <div className="text-xs text-gray-400 space-y-2">
        <p>1. Tap Run workflow.</p>
        <p>2. Paste the DNA into the dna field. Leave job_path empty unless you uploaded a jobs folder.</p>
        <p>3. When the run finishes, open it and download the framework-render artifact.</p>
        <p>Your own files: on GitHub, upload a folder under jobs/ with dna.json and a media/ folder, then set job_path to that folder. Missing required files stop the render. Nothing is substituted.</p>
      </div>
    </div>
  )
}
