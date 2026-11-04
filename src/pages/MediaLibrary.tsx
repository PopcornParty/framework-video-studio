import { useState, useEffect, useRef, useMemo } from 'react'
import { Upload, X, Trash2, Edit3, CheckSquare, Square } from 'lucide-react'
import {
  Asset,
  getAllAssets,
  saveAsset,
  deleteAsset,
  updateAsset,
  getNextAssetId,
  getAllTags,
  bulkDeleteAssets,
  bulkUpdateAssets,
} from '../lib/db'
import { parseTags, suggestTags, normalizeTag } from '../lib/tags'
import { extractMetadata } from '../lib/metadata'

const ACCEPTED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
])
const MAX_FILE_BYTES = 80 * 1024 * 1024
const LIBRARY_WARNING_BYTES = 500 * 1024 * 1024

function fileError(file: File): string | null {
  const type = file.type || guessType(file.name)
  if (!ACCEPTED.has(type)) return `${file.name}: unsupported type. Use JPEG, PNG, WebP, GIF, MP4, MOV, or WebM.`
  if (file.size > MAX_FILE_BYTES) return `${file.name}: ${Math.round(file.size / 1024 / 1024)}MB is over the ${MAX_FILE_BYTES / 1024 / 1024}MB file limit.`
  if (file.size === 0) return `${file.name}: file is empty.`
  return null
}

function guessType(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  return {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  }[ext || ''] || ''
}

interface UploadItem {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
  progress: number
}
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
  progress: number
}

export default function MediaLibrary() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [filterApproved, setFilterApproved] = useState<'all' | 'approved' | 'unapproved'>('all')
  const [editing, setEditing] = useState<Asset | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const [as, tags] = await Promise.all([getAllAssets(), getAllTags()])
    setAssets(as.sort((a, b) => b.createdAt - a.createdAt))
    setAllTags(tags.map(t => t.name).sort())
  }

  async function generateThumbnail(file: File): Promise<string> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const done = (data: string) => {
        URL.revokeObjectURL(url)
        resolve(data)
      }
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
          done(canvas.toDataURL('image/jpeg', 0.7))
        }
        img.onerror = () => done('')
        img.src = url
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.onloadeddata = () => {
          video.currentTime = Math.min(0.5, (video.duration || 1) / 2)
        }
        video.onseeked = () => {
          const canvas = document.createElement('canvas')
          const max = 200
          const scale = Math.min(max / video.videoWidth, max / video.videoHeight, 1)
          canvas.width = video.videoWidth * scale
          canvas.height = video.videoHeight * scale
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          done(canvas.toDataURL('image/jpeg', 0.7))
        }
        video.onerror = () => done('')
        video.src = url
      } else {
        done('')
      }
    })
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const items: UploadItem[] = Array.from(files).map(f => ({
      file: f,
      status: 'pending',
      progress: 0,
      error: fileError(f) || undefined,
    }))
    setUploads(items)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.error) {
        setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: 'error', progress: 0 } : u))
        continue
      }
      setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: 'uploading', progress: 15 } : u))
      try {
        const id = await getNextAssetId()
        const meta = await extractMetadata(item.file)
        if (!meta.width || !meta.height) throw new Error(`${item.file.name}: could not read the file. It may be corrupted.`)
        const thumbnail = await generateThumbnail(item.file)
        const suggested = parseTags(item.file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '))
        const asset: Asset = {
          id,
          filename: item.file.name,
          displayName: item.file.name.replace(/\.[^.]+$/, ''),
          description: '',
          keywords: suggested,
          subject: '',
          actions: [],
          environment: '',
          shotType: '',
          style: '',
          orientation: meta.orientation,
          duration: meta.duration,
          resolution: meta.resolution,
          width: meta.width,
          height: meta.height,
          source: 'user-upload',
          creator: '',
          licence: '',
          approved: false,
          createdAt: Date.now(),
          thumbnail,
          fileBlob: item.file,
        }
        await saveAsset(asset)
        setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: 'done', progress: 100 } : u))
      } catch (err) {
        setUploads(prev => prev.map((u, idx) => idx === i ? {
          ...u,
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
          progress: 0,
        } : u))
      }
    }
    await loadAll()
    if (fileInputRef.current) fileInputRef.current.value = ''
    setTimeout(() => setUploads([]), 4000)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(a => a.id)))
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} asset(s) permanently?`)) return
    await bulkDeleteAssets(Array.from(selected))
    setSelected(new Set())
    await loadAll()
  }

  async function handleBulkApprove(approved: boolean) {
    if (selected.size === 0) return
    await bulkUpdateAssets(Array.from(selected), { approved })
    setSelected(new Set())
    await loadAll()
  }

  function handleSaveEdit(updated: Asset) {
    updateAsset(updated.id, updated).then(loadAll)
    setEditing(null)
    setTagInput('')
  }

  const filtered = useMemo(() => {
    const tagQ = normalizeTag(tagFilter)
    return assets.filter(a => {
      const matchesSearch = !search ||
        a.displayName.toLowerCase().includes(search.toLowerCase()) ||
        a.description.toLowerCase().includes(search.toLowerCase()) ||
        a.keywords.some(k => k.includes(search.toLowerCase()))
      const matchesTag = !tagQ || a.keywords.some(k => k.includes(tagQ))
      const matchesFilter = filterApproved === 'all' ||
        (filterApproved === 'approved' && a.approved) ||
        (filterApproved === 'unapproved' && !a.approved)
      return matchesSearch && matchesTag && matchesFilter
    })
  }, [assets, search, tagFilter, filterApproved])

  const suggestions = useMemo(
    () => suggestTags(allTags, tagInput),
    [allTags, tagInput]
  )

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
      </div>
      <p className="text-xs text-gray-400">
        Upload many images or clips at once. Each file must be JPEG, PNG, WebP, GIF, MP4, MOV, or WebM, and no larger than 80MB. The library warns above 500MB. Assets stay in this browser. Nothing is discarded without an error.
      </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {uploads.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-400">Uploading {uploads.length} file(s)</p>
          {uploads.map((u, i) => (
            <div key={i} className="text-xs">
              <div className="flex justify-between">
                <span className="truncate max-w-[70%]">{u.file.name}</span>
                <span className={u.status === 'error' ? 'text-red-400' : u.status === 'done' ? 'text-green-400' : 'text-gray-400'}>
                  {u.status === 'error' ? u.error : u.status}
                </span>
              </div>
              <div className="h-1 bg-dark-border rounded mt-1">
                <div className="h-1 bg-blue-500 rounded" style={{ width: `${u.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        type="search"
        placeholder="Search name, description, tags..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm"
      />

      <input
        type="text"
        placeholder="Filter by tag..."
        value={tagFilter}
        onChange={(e) => setTagFilter(e.target.value)}
        className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm"
      />

      <div className="flex gap-2 text-sm flex-wrap">
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

      {filtered.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <button onClick={selectAll} className="flex items-center gap-1 text-gray-400">
            {selected.size === filtered.length ? <CheckSquare size={16} /> : <Square size={16} />}
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </button>
          {selected.size > 0 && (
            <>
              <button onClick={() => handleBulkApprove(true)} className="text-green-400 text-xs">Approve</button>
              <button onClick={() => handleBulkApprove(false)} className="text-gray-400 text-xs">Unapprove</button>
              <button onClick={handleBulkDelete} className="text-red-400 text-xs">Delete</button>
            </>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No assets yet</p>
          <p className="text-sm mt-2">Upload video or image files you have rights to use</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(asset => (
            <div key={asset.id} className="bg-dark-card border border-dark-border rounded-lg overflow-hidden relative">
              <button
                onClick={() => toggleSelect(asset.id)}
                className="absolute top-1 left-1 z-10 bg-black/50 rounded p-0.5"
              >
                {selected.has(asset.id) ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} className="text-gray-300" />}
              </button>
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
                    onClick={() => updateAsset(asset.id, { approved: !asset.approved }).then(loadAll)}
                    className={`text-xs px-2 py-0.5 rounded ${asset.approved ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}
                  >
                    {asset.approved ? 'Approved' : 'Unapproved'}
                  </button>
                </div>
                <p className="text-sm font-medium truncate mt-1">{asset.displayName}</p>
                <p className="text-xs text-gray-500">
                  {asset.orientation} {asset.duration ? `· ${asset.duration}s` : ''} {asset.resolution ? `· ${asset.resolution}` : ''}
                </p>
                {asset.keywords.length > 0 && (
                  <p className="text-xs text-blue-400 truncate">{asset.keywords.slice(0, 3).join(', ')}</p>
                )}
                <p className="text-xs text-gray-500 truncate">{asset.licence || 'No licence'}</p>
                <div className="flex gap-1 mt-2">
                  <button onClick={() => { setEditing(asset); setTagInput(asset.keywords.join(', ')) }} className="text-gray-400 hover:text-white">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => { if (confirm('Delete?')) deleteAsset(asset.id).then(loadAll) }} className="text-gray-400 hover:text-red-400">
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
              <h3 className="font-medium">Edit {editing.id}</h3>
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
            <div className="relative">
              <textarea
                className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm h-16"
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value)
                  setShowSuggestions(true)
                  setEditing({ ...editing, keywords: parseTags(e.target.value) })
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Tags (comma, semicolon, or new line)"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 bg-dark-card border border-dark-border rounded mt-1 w-full max-h-32 overflow-auto">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      className="block w-full text-left px-3 py-1 text-sm hover:bg-dark-border"
                      onClick={() => {
                        const current = parseTags(tagInput)
                        if (!current.includes(s)) {
                          const next = [...current, s].join(', ')
                          setTagInput(next)
                          setEditing({ ...editing, keywords: parseTags(next) })
                        }
                        setShowSuggestions(false)
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {editing.keywords.map(k => (
                <span key={k} className="text-xs bg-blue-900 text-blue-200 px-2 py-0.5 rounded">{k}</span>
              ))}
            </div>
            <input
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
              value={editing.licence}
              onChange={(e) => setEditing({ ...editing, licence: e.target.value })}
              placeholder="Licence information (required before approval for production)"
            />
            <input
              className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
              value={editing.creator}
              onChange={(e) => setEditing({ ...editing, creator: e.target.value })}
              placeholder="Creator"
            />
            <div className="text-xs text-gray-500">
              {editing.orientation} · {editing.resolution || 'unknown res'} · {editing.duration ? `${editing.duration}s` : 'no duration'}
            </div>
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
