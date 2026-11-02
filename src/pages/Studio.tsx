import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { decodeDna } from '../lib/dna/decode'
import { etaFromSteps, progressPercent, stagesFromSteps, ApiStep } from '../lib/cloud/status'

const REPO = 'PopcornParty/framework-video-studio'
const RUNS = `https://api.github.com/repos/${REPO}/actions/workflows/render.yml/runs?per_page=5`
const ACTIONS = `https://github.com/${REPO}/actions/workflows/render.yml`

interface Asset {
  name: string
  size: number
  browser_download_url: string
}

export default function Studio() {
  const [dna, setDna] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [runId, setRunId] = useState<number | null>(null)
  const [runStatus, setRunStatus] = useState('')
  const [steps, setSteps] = useState<ApiStep[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [note, setNote] = useState('')

  async function start() {
    setErrors([])
    setAssets([])
    setSteps([])
    setRunId(null)
    const result = await decodeDna(dna)
    if (!result.ok) {
      setErrors(result.errors)
      setNote('')
      return
    }
    try { await navigator.clipboard.writeText(dna) } catch { /* iPhone may block clipboard */ }
    setStartedAt(Date.now())
    setNote('DNA is valid. Confirm Run workflow on the GitHub page. This app has no token, so GitHub must start the job.')
    window.open(ACTIONS, '_blank')
  }

  useEffect(() => {
    if (!startedAt) return
    let stop = false
    async function poll() {
      try {
        const runs = await fetch(RUNS).then(r => r.json())
        const recent = (runs.workflow_runs || []).find((r: { created_at: string }) => new Date(r.created_at).getTime() >= startedAt - 15000)
        if (!recent) return
        setRunId(recent.id)
        setRunStatus(recent.conclusion || recent.status)
        const jobs = await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${recent.id}/jobs`).then(r => r.json())
        const jobSteps = (jobs.jobs?.[0]?.steps || []) as ApiStep[]
        setSteps(jobSteps)
        if (recent.conclusion === 'success') {
          const rel = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/render-${recent.id}`)
          if (rel.ok) {
            const body = await rel.json()
            setAssets(body.assets || [])
          }
        }
        if (recent.conclusion === 'failure') {
          setNote('The render failed. Nothing was marked successful.')
        }
      } catch (err) {
        setNote(err instanceof Error ? err.message : 'Could not read the workflow.')
      }
    }
    poll()
    const id = window.setInterval(() => { if (!stop) poll() }, 8000)
    return () => { stop = true; window.clearInterval(id) }
  }, [startedAt])

  const stages = stagesFromSteps(steps)
  const pct = progressPercent(steps)
  const eta = etaFromSteps(steps)
  const mp4 = assets.find(a => a.name.endsWith('.mp4'))
  const zip = assets.find(a => a.name.endsWith('.zip'))

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white px-4 pt-6 pb-10">
      <header className="mb-6">
        <p className="text-[11px] tracking-[0.22em] text-amber-200/80">FRAMEWORK</p>
        <h1 className="text-3xl font-semibold mt-1">Production</h1>
        <p className="text-sm text-zinc-400 mt-2">Paste DNA. Start. Download the finished video.</p>
      </header>

      <label className="block text-xs text-zinc-400 mb-2">DNA package</label>
      <textarea
        value={dna}
        onChange={e => setDna(e.target.value)}
        placeholder="Paste the complete FRAMEWORK DNA package"
        className="w-full h-52 rounded-2xl bg-zinc-900/80 border border-zinc-700 p-4 text-xs font-mono text-zinc-100"
      />
      <button
        onClick={start}
        disabled={!dna.trim()}
        className="mt-4 w-full min-h-[52px] rounded-2xl bg-amber-500 text-black font-semibold disabled:opacity-40"
      >
        Start production
      </button>
      {errors.length > 0 && (
        <div className="mt-4 rounded-2xl border border-red-800 bg-red-950/40 p-3">
          <p className="text-sm text-red-200">DNA was not accepted.</p>
          <ul className="mt-2 text-xs text-red-100 list-disc pl-4">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {startedAt && (
        <section className="mt-8 space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-medium">Status</h2>
            <p className="text-xs text-zinc-400">{pct === null ? 'Waiting for the run' : `${pct}%`} · {eta}</p>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-amber-400" style={{ width: `${pct || 0}%` }} />
          </div>
          <p className="text-xs text-zinc-400">{runId ? `Run ${runId} · ${runStatus}` : note}</p>
          <ul className="space-y-2">
            {stages.map(s => (
              <li key={s.name} className="flex justify-between text-sm border border-zinc-800 rounded-xl px-3 py-2">
                <span>{s.name}</span>
                <span className={s.state === 'failed' ? 'text-red-300' : 'text-zinc-400'}>{s.state}</span>
              </li>
            ))}
          </ul>
          {runStatus === 'failure' && <p className="text-sm text-red-300">Render failed. No download is offered.</p>}
        </section>
      )}

      {(mp4 || zip) && (
        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-medium">Finished video</h2>
          {mp4 && (
            <a className="block rounded-2xl bg-white text-black text-center py-3 font-medium" href={mp4.browser_download_url}>
              Download MP4 · {Math.round(mp4.size / 1024)} KB
            </a>
          )}
          {zip && (
            <a className="block rounded-2xl border border-zinc-600 text-center py-3" href={zip.browser_download_url}>
              Download ZIP · {Math.round(zip.size / 1024)} KB
            </a>
          )}
          <p className="text-xs text-zinc-500">Shown only after the release exists. These are the workflow files.</p>
        </section>
      )}

      <footer className="mt-10 text-xs text-zinc-500 flex justify-between">
        <Link to="/library">Tools</Link>
        <Link to="/capability">Device check</Link>
      </footer>
    </div>
  )
}
