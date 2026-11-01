import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProduction, saveProduction, Production } from '../lib/db'
import { STRUCTURES, HOOKS, STORYTELLING_VERSION, PACING_NOTES } from '../lib/storytelling/knowledge'
import { recommendStructure, recommendHook, getStructure } from '../lib/storytelling/select'
import { checkSufficientInformation } from '../lib/storytelling/check'
import { approvedFacts } from '../lib/research'
import type { StorytellingState } from '../lib/storytelling/types'

export default function StoryStructurePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [production, setProduction] = useState<Production | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getProduction(id).then(p => {
      setProduction(p || null)
      setLoading(false)
    })
  }, [id])

  async function applyRecommendation() {
    if (!production) return
    const facts = production.research ? approvedFacts(production.research.facts) : []
    const duration = production.interpretedIntent?.duration || 30
    const rec = recommendStructure({ prompt: production.prompt, approvedFacts: facts, requestedDurationSec: duration })
    const hasVerified = facts.some(f => f.verificationStatus === 'verified')
    const hook = recommendHook(rec.recommendedStructureId, hasVerified)
    const check = checkSufficientInformation({
      structureId: rec.recommendedStructureId,
      approvedFacts: facts,
      requestedDurationSec: duration,
      prompt: production.prompt,
    })
    const state: StorytellingState = {
      version: STORYTELLING_VERSION,
      recommendedStructureId: rec.recommendedStructureId,
      selectedStructureId: rec.recommendedStructureId,
      userOverride: false,
      recommendedHookId: hook.id,
      selectedHookId: hook.id,
      reason: rec.reason,
      issues: check.issues,
      lastUpdated: Date.now(),
    }
    const updated = { ...production, storytelling: state }
    await saveProduction(updated)
    setProduction(updated)
  }

  async function overrideStructure(structureId: string) {
    if (!production?.storytelling) return
    const facts = production.research ? approvedFacts(production.research.facts) : []
    const duration = production.interpretedIntent?.duration || 30
    const hasVerified = facts.some(f => f.verificationStatus === 'verified')
    const hook = recommendHook(structureId, hasVerified)
    const check = checkSufficientInformation({
      structureId,
      approvedFacts: facts,
      requestedDurationSec: duration,
      prompt: production.prompt,
    })
    const state: StorytellingState = {
      ...production.storytelling,
      selectedStructureId: structureId,
      userOverride: structureId !== production.storytelling.recommendedStructureId,
      recommendedHookId: hook.id,
      selectedHookId: hook.id,
      issues: check.issues,
      lastUpdated: Date.now(),
    }
    const updated = { ...production, storytelling: state }
    await saveProduction(updated)
    setProduction(updated)
  }

  async function overrideHook(hookId: string) {
    if (!production?.storytelling) return
    const facts = production.research ? approvedFacts(production.research.facts) : []
    const hasVerified = facts.some(f => f.verificationStatus === 'verified')
    const hook = HOOKS.find(h => h.id === hookId)
    if (hook?.requiresVerifiedFact && !hasVerified) return
    const state: StorytellingState = {
      ...production.storytelling,
      selectedHookId: hookId,
      lastUpdated: Date.now(),
    }
    const updated = { ...production, storytelling: state }
    await saveProduction(updated)
    setProduction(updated)
  }

  if (loading) return <div className="p-4">Loading...</div>
  if (!production) return <div className="p-4">Production not found.</div>

  const st = production.storytelling
  const selected = st ? getStructure(st.selectedStructureId) : undefined
  const selectedHook = st ? HOOKS.find(h => h.id === st.selectedHookId) : undefined
  const duration = production.interpretedIntent?.duration || 30
  const pacing = duration < 20 ? PACING_NOTES.short : duration <= 45 ? PACING_NOTES.medium : PACING_NOTES.long
  const facts = production.research ? approvedFacts(production.research.facts) : []
  const hasVerified = facts.some(f => f.verificationStatus === 'verified')

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold">Story structure</h2>
      <p className="text-xs text-gray-500">Production {production.id}. Research and media are unchanged.</p>
      <p className="text-sm text-gray-300">{production.prompt || '(no prompt)'}</p>

      {!st && (
        <button onClick={applyRecommendation} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm">
          Recommend structure
        </button>
      )}

      {st && (
        <>
          <div className="bg-dark-card border border-dark-border rounded-lg p-3">
            <p className="text-sm">Recommended structure: <span className="font-medium">{getStructure(st.recommendedStructureId)?.name}</span></p>
            <p className="text-xs text-gray-400 mt-1">{st.reason}</p>
            {st.userOverride && <p className="text-xs text-blue-400 mt-1">You overrode the structure recommendation.</p>}
          </div>

          <div>
            <label className="text-xs text-gray-400">Structure</label>
            <select
              className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm mt-1"
              value={st.selectedStructureId}
              onChange={e => overrideStructure(e.target.value)}
            >
              {STRUCTURES.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400">Hook</label>
            <select
              className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm mt-1"
              value={st.selectedHookId}
              onChange={e => overrideHook(e.target.value)}
            >
              {HOOKS.map(h => {
                const disabled = h.requiresVerifiedFact && !hasVerified
                return (
                  <option key={h.id} value={h.id} disabled={disabled}>
                    {h.name}{disabled ? ' (needs verified fact)' : ''}
                  </option>
                )
              })}
            </select>
            {selectedHook && (
              <div className="mt-2 bg-dark-bg border border-dark-border rounded-lg p-2">
                <p className="text-sm font-medium">Selected hook: {selectedHook.name}</p>
                <p className="text-xs text-gray-400 mt-1">{selectedHook.description}</p>
                {st.selectedHookId !== st.recommendedHookId && (
                  <p className="text-xs text-blue-400 mt-1">You overrode the hook recommendation.</p>
                )}
              </div>
            )}
          </div>

          {selected && (
            <div className="bg-dark-card border border-dark-border rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium">{selected.name}</p>
              <p className="text-xs text-gray-400">{selected.purpose}</p>
              <p className="text-xs text-gray-500">Requires: {selected.requires.join('; ')}</p>
              <p className="text-xs text-gray-500">Fails when: {selected.failsWhen.join('; ')}</p>
              <div className="mt-2 space-y-1">
                {selected.stages.map(stage => (
                  <div key={stage.id} className="text-xs border-l-2 border-dark-border pl-2">
                    <span className="font-medium">{stage.name}</span> — {stage.achieves}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-400">Pacing: {pacing}</div>

          {st.issues.length > 0 && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
              <p className="text-sm text-yellow-300">Insufficient information</p>
              <ul className="text-xs text-yellow-200/80 mt-1 list-disc pl-4">
                {st.issues.map((issue, i) => <li key={i}>{issue}</li>)}
              </ul>
              <p className="text-xs text-yellow-200/60 mt-2">No information has been invented to fill these gaps.</p>
            </div>
          )}

          {st.issues.length === 0 && (
            <p className="text-xs text-green-400">No blocking issues for this structure and duration.</p>
          )}
        </>
      )}

      <button onClick={() => navigate(`/research/${production.id}`)} className="text-xs text-gray-400 underline">
        Back to research
      </button>
    </div>
  )
}
