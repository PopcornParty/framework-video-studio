import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllProductions, deleteProduction, exportProject, importProject, Production } from '../lib/db'

export default function Productions() {
  const [productions, setProductions] = useState<Production[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const all = await getAllProductions()
    setProductions(all.sort((a, b) => b.updatedAt - a.updatedAt))
  }

  async function handleExport() {
    const data = await exportProject()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `framework-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await importProject(data)
      await load()
      alert('Project imported')
    } catch (err) {
      alert('Import failed: ' + (err instanceof Error ? err.message : 'unknown error'))
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Productions</h2>
        <div className="flex gap-2">
          <button onClick={handleExport} className="text-sm bg-dark-card border border-dark-border px-3 py-1.5 rounded-lg">
            Export
          </button>
          <button onClick={() => fileRef.current?.click()} className="text-sm bg-dark-card border border-dark-border px-3 py-1.5 rounded-lg">
            Import
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {productions.length === 0 ? (
        <p className="text-gray-400">No productions yet. Create a video to start.</p>
      ) : (
        <div className="space-y-2">
          {productions.map(p => (
            <div key={p.id} className="bg-dark-card border border-dark-border rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium">{p.title || 'Untitled'}</p>
                  <p className="text-xs text-gray-500">{p.id} · {p.status} · {p.storyboard.length} scenes</p>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.prompt}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => navigate(`/research/${p.id}`)}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                    >
                      Research
                    </button>
                    <button
                      onClick={() => navigate(`/structure/${p.id}`)}
                      className="text-xs border border-dark-border px-2 py-1 rounded"
                    >
                      Structure
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm('Delete production?')) deleteProduction(p.id).then(load) }}
                  className="text-xs text-red-400 ml-2"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Tap Research or Structure to reopen and edit a production. Existing data is preserved.
      </p>
    </div>
  )
}
