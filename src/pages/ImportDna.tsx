import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllProductions, getNextProductionId, saveProduction, Production } from '../lib/db'
import { decodeDna } from '../lib/dna/decode'
import { matchUserMedia, DroppedFile } from '../lib/dna/match'
import type { DnaPackage } from '../lib/dna/types'

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

async function toDropped(file: File): Promise<DroppedFile> {
  let readable = true
  let hash = ''
  try {
    hash = await hashFile(file)
  } catch {
    readable = false
  }
  return { name: file.name, size: file.size, type: file.type, hash, readable }
}

export default function ImportDna() {
  const navigate = useNavigate()
  const [raw, setRaw] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  async function importDna() {
    setBusy(true)
    setErrors([])
    setWarnings([])
    const result = await decodeDna(raw)
    if (!result.ok) {
      setErrors(result.errors)
      setBusy(false)
      return
    }

    const userVisuals = (result.dna.visuals || []).filter(v => v.origin === 'user-provided')
    const dropped = await Promise.all(files.map(toDropped))
    const match = matchUserMedia(result.dna.visuals || [], dropped)
    if (!match.ok) {
      setErrors(match.errors)
      setWarnings(match.warnings)
      setBusy(false)
      return
    }

    const existing = await getAllProductions()
    const dup = existing.find(p => p.dnaFingerprint === result.fingerprint)
    if (dup) {
      setWarnings([
        `This DNA was already imported as ${dup.id}. Opened the existing production. Nothing was overwritten.`,
        ...result.warnings,
        ...match.warnings,
      ])
      setBusy(false)
      navigate(`/research/${dup.id}`)
      return
    }

    const id = await getNextProductionId()
    const now = Date.now()
    const dna = result.dna
    const prod: Production = {
      id,
      title: dna.request.original.slice(0, 60),
      prompt: dna.request.original,
      research: {
        subject: dna.research.subject,
        sources: dna.research.sources.map(s => ({
          id: s.id,
          label: s.label,
          rawText: s.excerpt || '',
          publishedAt: s.publishedAt,
          addedAt: now,
        })),
        facts: dna.research.facts.map(f => ({
          id: f.id,
          statement: f.statement,
          sourceId: f.sourceIds[0] || '',
          verificationStatus: f.verificationStatus,
          approvedForScript: f.approvedForScript,
          conflictsWith: f.conflictsWith || [],
        })),
        gaps: dna.research.gaps || [],
        lastUpdated: now,
      },
      storytelling: dna.storytelling?.structureId
        ? {
            version: 1,
            recommendedStructureId: dna.storytelling.structureId,
            selectedStructureId: dna.storytelling.structureId,
            userOverride: false,
            recommendedHookId: dna.storytelling.hookId || 'question',
            selectedHookId: dna.storytelling.hookId || 'question',
            reason: dna.storytelling.reason || 'From DNA',
            issues: [],
            lastUpdated: now,
          }
        : undefined,
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
      dna: dna as DnaPackage,
      dnaFingerprint: result.fingerprint,
      dnaImportedAt: now,
      userMedia: match.matched.map(m => {
        const file = files.find(f => f.name === m.filename && f.size === m.size)
        return { ...m, blob: file }
      }),
    }
    await saveProduction(prod)
    setWarnings([
      ...result.warnings,
      ...match.warnings,
      userVisuals.length
        ? `Matched ${match.matched.length} user file(s). No download or render was performed.`
        : 'No user media in this DNA.',
    ])
    setBusy(false)
    navigate(`/research/${id}`)
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold">Import DNA</h2>
      <p className="text-xs text-gray-500">
        Paste DNA. If ChatGPT selected your uploads, drop those same files below. No renaming. This does not download external assets or render a video.
      </p>
      <textarea
        className="w-full h-48 bg-dark-card border border-dark-border rounded-lg p-3 text-xs font-mono"
        placeholder="---FRAMEWORK DNA v1---"
        value={raw}
        onChange={e => setRaw(e.target.value)}
      />
      <label className="block border border-dashed border-dark-border rounded-lg p-4 text-sm text-center">
        Drop user files (optional)
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          className="block w-full mt-2 text-xs"
          onChange={e => setFiles(Array.from(e.target.files || []))}
        />
      </label>
      {files.length > 0 && (
        <p className="text-xs text-gray-400">{files.length} file(s) ready. Unused files are ignored.</p>
      )}
      <button
        onClick={importDna}
        disabled={busy || !raw.trim()}
        className="w-full bg-blue-600 disabled:opacity-50 text-white py-3 rounded-lg text-sm"
      >
        {busy ? 'Checking...' : 'Validate and import'}
      </button>
      {errors.length > 0 && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
          <p className="text-sm text-red-300">Import stopped. Nothing was saved.</p>
          <ul className="text-xs text-red-200 mt-2 list-disc pl-4">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
          <ul className="text-xs text-yellow-100 list-disc pl-4">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
