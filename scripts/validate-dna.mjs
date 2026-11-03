#!/usr/bin/env node
/**
 * Extract and validate FRAMEWORK DNA v1 from wrapped block or raw JSON.
 * Used by the GitHub Actions render workflow. No network. No ffmpeg.
 *
 * Reads raw DNA from the DNA environment variable.
 * On success writes cleaned JSON to job/dna.json.
 * On failure writes a report and exits 1.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { planJob } from './render-plan.mjs'

export function extractJson(raw) {
  if (typeof raw !== 'string') return ''
  const start = raw.indexOf('---FRAMEWORK DNA')
  const end = raw.indexOf('---END FRAMEWORK DNA---')
  if (start !== -1 && end !== -1 && end > start) {
    const headerEnd = raw.indexOf('---', start + 3)
    const jsonStart = raw.indexOf('\n', headerEnd)
    if (jsonStart !== -1 && jsonStart < end) return raw.slice(jsonStart, end).trim()
  }
  return raw.trim()
}

export function validateDna(raw) {
  const errors = []
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, errors: ['DNA is empty.'] }
  }

  const jsonText = extractJson(raw)
  if (!jsonText) {
    return { ok: false, errors: ['No DNA content found.'] }
  }

  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return { ok: false, errors: ['DNA is not valid JSON.'] }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errors: ['DNA must be a JSON object.'] }
  }

  if (parsed.schema !== 'framework-dna') {
    errors.push('schema must be "framework-dna".')
  }
  if (parsed.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1.')
  }

  if (errors.length) return { ok: false, errors }

  // Early plan check (no user media available in pure DNA input path)
  const plan = planJob(parsed, [])
  if (!plan.ok) {
    return { ok: false, errors: plan.errors }
  }

  return { ok: true, dna: parsed, errors: [] }
}

function fail(message) {
  mkdirSync('render-out', { recursive: true })
  writeFileSync('render-out/report.txt', `FAILED\n${message}\n`)
  console.error(message)
  process.exit(1)
}

// CLI entry
const isMain = process.argv[1] && (
  process.argv[1].endsWith('validate-dna.mjs') ||
  process.argv[1].endsWith('validate-dna.js')
)

if (isMain) {
  const raw = process.env.DNA || ''
  if (!raw.trim()) fail('DNA input is required.')

  const result = validateDna(raw)
  if (!result.ok) fail(result.errors.join('\n'))

  mkdirSync('job', { recursive: true })
  writeFileSync('job/dna.json', JSON.stringify(result.dna, null, 2))
  console.log('DNA validated:', result.dna.schema, 'v' + result.dna.schemaVersion)
  console.log('Shots planned:', (result.dna.visuals || []).length)
}
