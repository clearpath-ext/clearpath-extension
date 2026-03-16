import { describe, it, expect } from 'vitest'
import * as highlighter from '../../src/content/highlighter'

// highlighter.ts is a stub in Phase 1 (all functions are no-ops).
// Tests confirm the public API exists and does not throw.
describe('highlighter', () => {
  it('init() does not throw', () => {
    expect(() => highlighter.init()).not.toThrow()
  })

  it('onWordBoundary() does not throw', () => {
    expect(() => highlighter.onWordBoundary(5, 'hello world')).not.toThrow()
  })

  it('clear() does not throw', () => {
    expect(() => highlighter.clear()).not.toThrow()
  })
})
