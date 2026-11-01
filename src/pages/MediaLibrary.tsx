import { useState, useEffect, useRef } from 'react'
import { Upload, Check, X, Trash2, Edit3 } from 'lucide-react'
import { Asset, getAllAssets, saveAsset, deleteAsset, updateAsset, getNextAssetId } from '../lib/db'

export default function MediaLibrary() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [search, setSearch] = useState('')
  const [filterApproved, setFilterApproved] = useState<'all' | 'approved' | 'unapproved'>('all')
  const [editing, setEditing] = useState<Asset | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadAssets()
  }, [])

  async function loadAssets() {
    const all = await getAllAssets()
    setAssets(all.sort((a, b) => b.createdAt - a.createdAt))
  }

  async function generateThumbnail(file: File): Promise<string> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      if (file.type.startsWith('image/')) {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const max = 200
          const scale = Math.min(max / img.width, max / img.height, 1)
          canvas.width = img.width * scale
          canvas.height = img.height * scale
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.7))
          URL.revokeObjectURL(url)
        }
        img.src = url
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.onloadeddata = () => {
          video.currentTime = Math.min(1, video.duration / 2)
        }
        video.onseeked = () => {
          const canvas = document.createElement('canvas')
          const max = 200
          const scale = Math.min(max / video.videoWidth, max / video.videoHeight, 1)
          canvas.width = video.videoWidth * scale
          canvas.height = video.videoHeight * scale
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.7))
          URL.revokeObjectURL(url)
        }
        video.src = url
      } else {
        resolve('')
      }
    })
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      const id = await getNextAssetId()
      const thumbnail = await generateThumbnail(file)
      const asset: Asset = {
        id,
        filename: file.name,
        displayName: file.name.replace(/\.[^.]+$/, ''),
        description: '',
        keywords: [],
        subject: '',
        actions: [],
        environment: '',
        shotType: '',
        style: '',
        orientation: file.type.startsWith('video/') ? 'unknown' : 'unknown',
        duration: 0,
        resolution: '',
        source: 'user-upload',
        creator: '',
        licence: '',
        approved: false,
        createdAt: Date.now(),
        thumbnail,
        fileBlob: file,
      }
      await saveAsset(asset)
    }
    await loadAssets()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this asset permanently?')) {
      await deleteAsset(id)
      await loadAssets()
    }
  }

  async function handleToggleApproved(asset: Asset) {
    await updateAsset(asset.id, { approved: !asset.approved })
    await loadAssets()
  }

  function handleSaveEdit(updated: Asset) {
    updateAsset(updated.id, updated).then(loadAssets)
    setEditing(null)
  }

  const filtered = assets.filter(a => {
    const matchesSearch = !search || 
      a.displayName.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.keywords.some(k => k.toLowerCase().includes(search.toLowerCase()))
    const matchesFilter = filterApproved === 'all' || 
      (filterApproved === 'approved' && a.approved) ||
      (filterApproved === 'unapproved' && !a.approved)
    return matchesSearch && matchesFilter
  })

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Media Library</h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
        >
          <Upload size={16} />
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      <input
        type="search"
        placeholder="Search assets..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm"
      />

      <div className="flex gap-2 text-sm">
        {(['all', 'approved', 'unapproved'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterApproved(f)}
            className={`px-3 py-1 rounded-full border ${filterApproved === f ? 'bg-blue-600 border-blue-600 text-white' : 'border-dark-border text-gray-400'}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No assets yet</p>
          <p className="text-sm mt-2">Upload video or image files you have rights to use</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(asset => (
            <div key={asset.id} className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
              {asset.thumbnail ? (
                <img src={asset.thumbnail} alt="" className="w-full h-24 object-cover" />
              ) : (
                <div className="w-full h-24 bg-dark-border flex items-center justify-center text-xs text-gray-500">
                  No preview
                </div>
              )}
              <div className="p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-500">{asset.id}</span>
                  <button
                    onClick={() => handleToggleApproved(asset)}
                    className={`text-xs px-2 py-0.5 rounded ${asset.approved ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}
                  >
                    {asset.approved ? 'Approved' : 'Unapproved'}
                  </button>
                </div>
                <p className="text-sm font-medium truncate mt-1">{asset.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{asset.licence || 'No licence info'}</p>
                <div className="flex gap-1 mt-2">
                  <button onClick={() => setEditing(asset)} className="text-gray-400 hover:text-white">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(asset.id)} className="text-gray-400 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg w-full max-w-md max-h-[80vh] overflow-auto p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Edit Asset</h3>
              <button onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <input
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
              value={editing.displayName}
              onChange={(e) => setEditing({ ...editing, displayName: e.target.value })}
              placeholder="Display name"
            />
            <textarea
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm h-20"
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="Description"
            />
            <input
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
              value={editing.keywords.join(', ')}
              onChange={(e) => setEditing({ ...editing, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="Keywords (comma separated)"
            />
            <input
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
              value={editing.licence}
              onChange={(e) => setEditing({ ...editing, licence: e.target.value })}
              placeholder="Licence information"
            />
            <input
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
              value={editing.creator}
              onChange={(e) => setEditing({ ...editing, creator: e.target.value })}
              placeholder="Creator"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveEdit(editing)}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 border border-dark-border rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
