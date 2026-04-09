import { describe, it, expect } from 'vitest'
import { ALL_SYMBOL_MAP, KEY_SYMBOL_WORDS } from '../../src/content/symbolData'

describe('symbolData', () => {
  it('ALL_SYMBOL_MAP has entries', () => {
    expect(Object.keys(ALL_SYMBOL_MAP).length).toBeGreaterThan(50)
  })

  it('all values in ALL_SYMBOL_MAP are non-empty strings', () => {
    for (const [key, value] of Object.entries(ALL_SYMBOL_MAP)) {
      expect(typeof value, `value for "${key}"`).toBe('string')
      expect(value.length, `value for "${key}"`).toBeGreaterThan(0)
    }
  })

  it('KEY_SYMBOL_WORDS is a non-empty set', () => {
    expect(KEY_SYMBOL_WORDS.size).toBeGreaterThan(10)
  })

  it('every word in KEY_SYMBOL_WORDS exists in ALL_SYMBOL_MAP', () => {
    for (const word of KEY_SYMBOL_WORDS) {
      expect(ALL_SYMBOL_MAP[word], `"${word}" should be in ALL_SYMBOL_MAP`).toBeDefined()
    }
  })

  it('KEY_SYMBOL_WORDS is a strict subset of ALL_SYMBOL_MAP keys', () => {
    expect(KEY_SYMBOL_WORDS.size).toBeLessThan(Object.keys(ALL_SYMBOL_MAP).length)
  })

  it('contains expected core AAC words', () => {
    expect(KEY_SYMBOL_WORDS.has('eat')).toBe(true)
    expect(KEY_SYMBOL_WORDS.has('drink')).toBe(true)
    expect(KEY_SYMBOL_WORDS.has('help')).toBe(true)
    expect(KEY_SYMBOL_WORDS.has('yes')).toBe(true)
    expect(KEY_SYMBOL_WORDS.has('no')).toBe(true)
  })
})
