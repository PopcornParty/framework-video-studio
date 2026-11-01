import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllProductions, getAllAssets, Production } from '../lib/db'

export default function Dashboard() {
  const navigate = useNavigate()
  const [productions, setProductions] = useState<Production[]>([])
  const [assetCount, setAssetCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAllProductions(), getAllAssets()]).then(([prods, assets]) => {
      setProductions(prods.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5))
      setAssetCount(assets.length)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <div className="grid gap-4">
          <div className="bg-dark-card border border-dark-border rounded-lg p-4">
            <h3 className="font-medium mb-2">Recent productions</h3>
            {productions.length === 0 ? (
              <p className="text-sm text-gray-400">No productions yet. Use Create to start one.</p>
            ) : (
              <div className="space-y-2">
                {productions.map(p => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/research/${p.id}`)}
                    className="w-full text-left text-sm py-2 border-b border-dark-border last:border-0"
                  >
                    <span className="font-medium">{p.title || 'Untitled'}</span>
                    <span className="text-xs text-gray-500 block">{p.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="bg-dark-card border border-dark-border rounded-lg p-4">
            <h3 className="font-medium mb-2">Media library</h3>
            <p className="text-sm text-gray-400">{assetCount} asset{assetCount === 1 ? '' : 's'}</p>
            <button onClick={() => navigate('/library')} className="text-xs text-blue-400 mt-2">
              Open library
            </button>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-lg p-4">
            <h3 className="font-medium mb-2">Storage</h3>
            <p className="text-sm text-gray-400">Data is stored locally in IndexedDB on this device.</p>
          </div>
        </div>
      )}
    </div>
  )
}
