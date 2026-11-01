import { describe, it, expect } from 'vitest'

function formatAssetId(n: number): string {
  return `AST-${String(n).padStart(6, '0')}`
}

function formatProductionId(n: number): string {
  return `PRD-${String(n).padStart(6, '0')}`
}

describe('ID formatting', () => {
  it('pads asset IDs to 6 digits', () => {
    expect(formatAssetId(1)).toBe('AST-000001')
    expect(formatAssetId(42)).toBe('AST-000042')
    expect(formatAssetId(100000)).toBe('AST-100000')
  })
  it('pads production IDs to 6 digits', () => {
    expect(formatProductionId(1)).toBe('PRD-000001')
  })
  it('never reuses the same number format', () => {
    const ids = new Set([formatAssetId(1), formatAssetId(2), formatAssetId(1)])
    expect(ids.size).toBe(2)
  })
})
