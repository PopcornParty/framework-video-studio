import { useState } from 'react'
import { fetchWikimedia, readUserPhoto, recordCanvasTest, CheckResult } from '../lib/diag/capability'

export default function CapabilityCheck() {
  const [results, setResults] = useState<CheckResult[]>([])
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function add(r: CheckResult) {
    setResults(prev => [...prev.filter(x => x.name !== r.name), r])
  }

  async function runMp4() {
    setBusy(true)
    setDownloadUrl(null)
    const { result, blob } = await recordCanvasTest()
    add(result)
    if (blob && result.ok) {
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
    }
    setBusy(false)
  }

  async function runWiki() {
    setBusy(true)
    add(await fetchWikimedia())
    setBusy(false)
  }

  async function onPhoto(file: File) {
    setBusy(true)
    add(await readUserPhoto(file))
    setBusy(false)
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold">iPhone capability check</h2>
      <p className="text-xs text-gray-500">
        These buttons attempt the real action. A green result means it worked on this device. API names alone are not treated as success.
      </p>
      <button onClick={runWiki} disabled={busy} className="w-full border border-dark-border py-3 rounded-lg text-sm">
        Fetch and read a Wikimedia image
      </button>
      <label className="block border border-dark-border py-3 rounded-lg text-sm text-center">
        Read a photo from this phone
        <input
          type="file"
          accept="image/*"
          className="block w-full mt-2 text-xs"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) onPhoto(f)
          }}
        />
      </label>
      <button onClick={runMp4} disabled={busy} className="w-full bg-blue-600 disabled:opacity-50 text-white py-3 rounded-lg text-sm">
        Record a 2-second canvas MP4
      </button>
      {downloadUrl && (
        <a href={downloadUrl} download="framework-capability-test.mp4" className="block text-center text-sm text-blue-400 underline">
          Download the test MP4
        </a>
      )}
      <ul className="space-y-2">
        {results.map(r => (
          <li key={r.name} className={`rounded-lg p-3 text-sm border ${r.ok ? 'border-green-700 bg-green-900/20' : 'border-red-700 bg-red-900/20'}`}>
            <p className="font-medium">{r.ok ? 'Passed' : 'Failed'}: {r.name}</p>
            <p className="text-xs text-gray-300 mt-1">{r.detail}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">
        This page does not change research, structure, DNA import, or user-media matching. It does not render a production.
      </p>
    </div>
  )
}
