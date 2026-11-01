import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllProductions, getNextProductionId, saveProduction, Production } from '../lib/db'
import { decodeDna } from '../lib/dna/decode'
import type { DnaPackage } from '../lib/dna/types'

export default function ImportDna() {
  const navigate = useNavigate()
  const [raw, setRaw] = useState('')
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

    const existing = await getAllProductions()
    const dup = existing.find(p => p.dnaFingerprint === result.fingerprint)
    if (dup) {
      setWarnings([
        `This DNA was already imported as ${dup.id}. Opened the existing production. Nothing was overwritten.`,
        ...result.warnings,
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
    }
    await saveProduction(prod)
    setWarnings(result.warnings)
    setBusy(false)
    navigate(`/research/${id}`)
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold">Import DNA</h2>
      <p className="text-xs text-gray-500">
        Paste a FRAMEWORK DNA v1 package. This validates and stores the plan. It does not download assets or render a video.
      </p>
      <textarea
        className="w-full h-64 bg-dark-card border border-dark-border rounded-lg p-3 text-xs font-mono"
        placeholder="---FRAMEWORK DNA v1---"
        value={raw}
        onChange={e => setRaw(e.target.value)}
      />
      <button
        onClick={importDna}
        disabled={busy || !raw.trim()}
        className="w-full bg-blue-600 disabled:opacity-50 text-white py-3 rounded-lg text-sm"
      >
        {busy ? 'Checking...' : 'Validate and import'}
      </button>
      {errors.length > 0 && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
          <p className="text-sm text-red-300">Import failed. Nothing was saved.</p>
          <ul className="text-xs text-red-200 mt-2 list-disc pl-4">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      {warnings.length > 0 && errors.length === 0 && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
          <ul className="text-xs text-yellow-100 list-disc pl-4">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
