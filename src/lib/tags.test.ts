import { describe, it, expect } from 'vitest'
import { normalizeTag, parseTags, mergeTags, suggestTags } from './tags'

describe('normalizeTag', () => {
  it('lowercases and trims', () => {
    expect(normalizeTag('  Supercar  ')).toBe('supercar')
  })
  it('collapses whitespace', () => {
    expect(normalizeTag('sports   car')).toBe('sports car')
  })
  it('strips special characters', () => {
    expect(normalizeTag('night-time!')).toBe('night-time')
    expect(normalizeTag('close-up?')).toBe('close-up')
  })
  it('returns empty for blank', () => {
    expect(normalizeTag('   ')).toBe('')
  })
})

describe('parseTags', () => {
  it('splits on commas', () => {
    expect(parseTags('car, night, driving')).toEqual(['car', 'night', 'driving'])
  })
  it('splits on semicolons', () => {
    expect(parseTags('car; night; driving')).toEqual(['car', 'night', 'driving'])
  })
  it('splits on newlines', () => {
    expect(parseTags('car\nnight\ndriving')).toEqual(['car', 'night', 'driving'])
  })
  it('mixes separators and dedupes case-insensitively', () => {
    expect(parseTags('Car, car; CAR\nnight')).toEqual(['car', 'night'])
  })
  it('normalises whitespace and special chars', () => {
    expect(parseTags('  sports  car , close-up! ')).toEqual(['sports car', 'close-up'])
  })
  it('returns empty for empty input', () => {
    expect(parseTags('')).toEqual([])
  })
})

describe('mergeTags', () => {
  it('adds new tags without duplicates', () => {
    expect(mergeTags(['car', 'night'], ['night', 'driving'])).toEqual(['car', 'night', 'driving'])
  })
})

describe('suggestTags', () => {
  it('filters by prefix preference', () => {
    const all = ['car', 'sports car', 'supercar', 'night']
    expect(suggestTags(all, 'car')).toEqual(['car', 'sports car', 'supercar'])
  })
  it('returns limited results', () => {
    const all = ['a', 'b', 'c', 'd']
    expect(suggestTags(all, '', 2)).toEqual(['a', 'b'])
  })
})
