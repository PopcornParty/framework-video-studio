/** Decide what a cloud render may do. No network. No ffmpeg. No fake success. */

export function planJob(dna, availableFiles = []) {
  const errors = []
  const shots = []
  if (!dna || dna.schema !== 'framework-dna' || dna.schemaVersion !== 1) {
    return { ok: false, errors: ['DNA must be framework-dna schemaVersion 1.'], shots: [] }
  }
  const visuals = Array.isArray(dna.visuals) ? dna.visuals : []
  if (visuals.length === 0) {
    return { ok: false, errors: ['DNA has no visuals. Refusing to invent footage.'], shots: [] }
  }
  const files = new Set(availableFiles.map(f => String(f).toLowerCase()))
  for (const v of visuals) {
    if (v.origin === 'user-provided') {
      const name = v.originalFilename || ''
      if (!files.has(name.toLowerCase())) {
        if (v.required !== false) {
          errors.push(`Missing user asset ${v.id} (${name || 'unnamed'}). Upload it in the job folder. Not substituting.`) 
        }
        continue
      }
      shots.push({ id: v.id, kind: 'file', file: name, depicts: v.depicts || '' })
    } else if (v.origin === 'external') {
      const url = v.obtain?.url || ''
      if (!url.startsWith('https://')) {
        errors.push(`External visual ${v.id} needs an https URL.`)
        continue
      }
      if (!v.obtain?.licence || !v.obtain?.commercialUse || v.obtain.commercialUse === 'unknown') {
        errors.push(`External visual ${v.id} needs a licence and known commercialUse.`)
        continue
      }
      shots.push({ id: v.id, kind: 'url', url, depicts: v.depicts || '' })
    } else {
      errors.push(`Visual ${v.id} has an unknown origin.`)
    }
  }
  if (!shots.length && !errors.length) {
    errors.push('No usable visuals after checks.')
  }
  return { ok: errors.length === 0, errors, shots }
}
