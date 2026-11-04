import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProduction, saveProduction, type Production, type TimelineClip } from '../lib/db'

const TRANSITIONS = ['cut', 'fade', 'wipe-left', 'wipe-right', 'whip-left', 'whip-right', 'zoom', 'zoom-blur', 'glitch', 'flash', 'film-burn', 'light-leak']

export default function StoryboardEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [production, setProduction] = useState<Production | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!id) return
    getProduction(id).then(found => setProduction(found || null))
  }, [id])

  if (!id) {
    return <div className="p-4 text-sm text-gray-400">Open a production to edit its timeline.</div>
  }
  if (!production) {
    return <div className="p-4 text-sm text-gray-400">Production {id} was not found.</div>
  }

  const clips = production.timeline.length
    ? production.timeline
    : production.storyboard.map((scene, index) => ({
        id: `SC-${index + 1}`,
        assetId: scene.assetId,
        trimStart: 0,
        trimEnd: scene.duration,
        duration: scene.duration,
        transition: scene.transition || 'cut',
        textOverlay: scene.textOverlay,
        volume: 1,
      }))

  function update(index: number, patch: Partial<TimelineClip>) {
    const next = clips.map((clip, i) => i === index ? { ...clip, ...patch } : clip)
    setProduction({ ...production!, timeline: next })
  }

  async function save() {
    if (!production) return
    await saveProduction({ ...production, timeline: clips })
    setMessage('Timeline saved. Advanced transitions stay only where you set them.')
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold">Timeline</h2>
      <p className="text-sm text-gray-400">
        {production.title}. Scenes can be 0.5 seconds or longer. Default is a clean cut or simple fade. Advanced transitions are used only when you choose one.
      </p>
      <div className="space-y-2">
        {clips.map((clip, index) => (
          <div key={clip.id} className="border border-dark-border rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
            <div className="col-span-2 font-medium">{clip.id} · {clip.assetId || 'no asset'}</div>
            <label>Duration
              <input className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1" type="number" min="0.5" max="30" step="0.1" value={clip.duration} onChange={e => update(index, { duration: Number(e.target.value) })} />
            </label>
            <label>Transition to next
              <select className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1" value={clip.transition || 'cut'} onChange={e => update(index, { transition: e.target.value })}>
                {TRANSITIONS.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
          </div>
        ))}
        {clips.length === 0 && <p className="text-sm text-gray-400">This production has no scenes yet.</p>}
      </div>
      <button onClick={save} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm">Save timeline</button>
      {message && <p className="text-sm text-green-400">{message}</p>}
      <button onClick={() => navigate('/productions')} className="text-sm text-gray-400 underline block">Back to projects</button>
    </div>
  )
}
