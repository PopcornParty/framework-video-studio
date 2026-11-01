import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProduction, saveProduction, getNextProductionId, Production } from '../lib/db'
import {
  Research as ResearchType,
  Source,
  Fact,
  VerificationStatus,
  createSource,
  extractCandidateFacts,
  detectConflicts,
  setApprovedForScript,
  setVerificationStatus,
  approvedFacts,
  scriptTreatment,
  resetIdCounter,
} from '../lib/research'

export default function ResearchPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [production, setProduction] = useState<Production | null>(null)
  const [label, setLabel] = useState('')
  const [rawText, setRawText] = useState('')
  const [publishedAt, setPublishedAt] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (id) {
        const p = await getProduction(id)
        if (p) {
          setProduction(p)
          setLoading(false)
          return
        }
      }
      const newId = await getNextProductionId()
      const now = Date.now()
      const fresh: Production = {
        id: newId,
        title: '',
        prompt: '',
        research: { subject: '', sources: [], facts: [], gaps: [], lastUpdated: now },
        storyboard: [],
        timeline: [],
        renderSettings: { width: 1080, height: 1920, fps: 30, aspectRatio: '9:16', quality: 'high' },
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      }
      await saveProduction(fresh)
      setProduction(fresh)
      setLoading(false)
      navigate(`/research/${newId}`, { replace: true })
    }
    load()
  }, [id, navigate])

  async function addSource() {
    if (!production || !rawText.trim()) return
    resetIdCounter(Date.now() % 10000)
    const source = createSource(label, rawText, publishedAt || undefined)
    const candidates = extractCandidateFacts(rawText, source.id)
    const research: ResearchType = production.research || {
      subject: '', sources: [], facts: [], gaps: [], lastUpdated: Date.now(),
    }
    const allFacts = detectConflicts([...research.facts, ...candidates])
    const updated: Production = {
      ...production,
      research: {
        ...research,
        sources: [...research.sources, source],
        facts: allFacts,
        lastUpdated: Date.now(),
      },
    }
    await saveProduction(updated)
    setProduction(updated)
    setLabel('')
    setRawText('')
    setPublishedAt('')
  }

  async function toggleApproved(factId: string, current: boolean) {
    if (!production?.research) return
    const facts = setApprovedForScript(production.research.facts, factId, !current)
    const updated: Production = {
      ...production,
      research: { ...production.research, facts, lastUpdated: Date.now() },
    }
    await saveProduction(updated)
    setProduction(updated)
  }

  async function changeVerification(factId: string, status: VerificationStatus) {
    if (!production?.research) return
    const facts = setVerificationStatus(production.research.facts, factId, status)
    const updated: Production = {
      ...production,
      research: { ...production.research, facts, lastUpdated: Date.now() },
    }
    await saveProduction(updated)
    setProduction(updated)
  }

  if (loading || !production) return <div className="p-4">Loading...</div>

  const research = production.research
  const approved = research ? approvedFacts(research.facts) : []
  const conflicts = research?.facts.filter(f => f.conflictsWith.length > 0) || []

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold">Research</h2>
      <p className="text-xs text-gray-500">
        Approving a fact allows it in the script. It does not change how the fact may be stated. Verification rules always apply.
      </p>

      <div className="bg-dark-card border border-dark-border rounded-lg p-3 space-y-2">
        <input
          className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
          placeholder="Source label"
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
        <input
          type="date"
          className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
          value={publishedAt}
          onChange={e => setPublishedAt(e.target.value)}
        />
        <textarea
          className="w-full h-32 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm"
          placeholder="Paste source text here..."
          value={rawText}
          onChange={e => setRawText(e.target.value)}
        />
        <button
          onClick={addSource}
          disabled={!rawText.trim()}
          className="w-full bg-blue-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm"
        >
          Add source and extract facts
        </button>
      </div>

      {research && research.sources.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Sources ({research.sources.length})</h3>
          {research.sources.map((s: Source) => (
            <div key={s.id} className="text-xs text-gray-400 mb-1">
              {s.label} {s.publishedAt ? `· ${s.publishedAt}` : ''} · {s.id}
            </div>
          ))}
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
          <p className="text-sm text-yellow-300">Possible conflicts ({conflicts.length} facts)</p>
          <p className="text-xs text-yellow-200/70 mt-1">
            Detection only looks for different numbers plus shared words. It can miss real contradictions and can flag unrelated numbers.
          </p>
        </div>
      )}

      {research && research.facts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Facts ({research.facts.length})</h3>
          {research.facts.map((f: Fact) => {
            const treatment = scriptTreatment(f.verificationStatus)
            return (
              <div key={f.id} className="bg-dark-card border border-dark-border rounded-lg p-3">
                <p className="text-sm">{f.statement}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {f.id} · source {f.sourceId}
                  {f.conflictsWith.length > 0 && (
                    <span className="text-yellow-400"> · possible conflict with {f.conflictsWith.join(', ')}</span>
                  )}
                </p>
                <p className="text-xs mt-1 text-gray-400">
                  Script rule: {treatment}
                  {f.approvedForScript ? ' · approved for script' : ' · not approved'}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={() => toggleApproved(f.id, f.approvedForScript)}
                    className={`text-xs px-2 py-1 rounded ${f.approvedForScript ? 'bg-green-700 text-white' : 'border border-dark-border'}`}
                  >
                    {f.approvedForScript ? 'Approved' : 'Approve for script'}
                  </button>
                  <select
                    className="text-xs bg-dark-bg border border-dark-border rounded px-2 py-1"
                    value={f.verificationStatus}
                    onChange={e => changeVerification(f.id, e.target.value as VerificationStatus)}
                  >
                    <option value="verified">Verified</option>
                    <option value="user-stated">User-stated</option>
                    <option value="unverified">Unverified</option>
                    <option value="assumption">Assumption</option>
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-1">
        <p>Approved for script: {approved.length}</p>
        <p>Verified → may be stated as fact. User-stated → attribute. Unverified → qualify or exclude. Assumption → never as fact.</p>
      </div>

      <button
        onClick={() => navigate(`/structure/${production.id}`)}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm"
      >
        Continue to story structure
      </button>
    </div>
  )
}
