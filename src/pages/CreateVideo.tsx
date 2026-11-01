import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNextProductionId, saveProduction, Production } from '../lib/db'

export default function CreateVideo() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(30)
  const [platform, setPlatform] = useState('YouTube Shorts')

  async function start() {
    const id = await getNextProductionId()
    const now = Date.now()
    const prod: Production = {
      id,
      title: prompt.slice(0, 60) || 'Untitled',
      prompt,
      research: { subject: '', sources: [], facts: [], gaps: [], lastUpdated: now },
      interpretedIntent: {
        subject: '',
        duration,
        platform,
        style: '',
        storyBeats: [],
      },
      storyboard: [],
      timeline: [],
      renderSettings: {
        width: 1080,
        height: 1920,
        fps: 30,
        aspectRatio: '9:16',
        quality: 'high',
      },
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }
    await saveProduction(prod)
    navigate(`/research/${id}`)
  }

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-semibold">Create Video</h2>
      <textarea
        className="w-full h-40 bg-dark-card border border-dark-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-blue-500"
        placeholder="Describe the video you want to create..."
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
      />
      <div className="flex gap-4">
        <select
          className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm"
          value={duration}
          onChange={e => setDuration(Number(e.target.value))}
        >
          <option value={15}>15 seconds</option>
          <option value={30}>30 seconds</option>
          <option value={60}>60 seconds</option>
        </select>
        <select
          className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm"
          value={platform}
          onChange={e => setPlatform(e.target.value)}
        >
          <option>YouTube Shorts</option>
          <option>TikTok</option>
          <option>Instagram Reels</option>
        </select>
      </div>
      <button
        onClick={start}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium"
      >
        Start with Research
      </button>
      <p className="text-xs text-gray-500">
        This creates a production and opens the research intake. Existing media library data is preserved.
      </p>
    </div>
  )
}
