import { describe, it, expect, beforeEach } from 'vitest'
import * as symbols from '../../src/content/symbols'

function makeContainer(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

describe('symbols', () => {
  beforeEach(() => {
    symbols.init()
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    vi.mocked(chrome.runtime.getURL).mockImplementation((path) => `chrome-extension://test/${path}`)
  })

  it('init resets enabled to false and density to key', () => {
    symbols.setEnabled(true)
    symbols.setDensity('all')
    symbols.init()
    expect(symbols.isEnabled()).toBe(false)
    expect(symbols.getDensity()).toBe('key')
  })

  it('isEnabled reflects setEnabled', () => {
    symbols.setEnabled(true)
    expect(symbols.isEnabled()).toBe(true)
    symbols.setEnabled(false)
    expect(symbols.isEnabled()).toBe(false)
  })

  it('getDensity reflects setDensity', () => {
    symbols.setDensity('all')
    expect(symbols.getDensity()).toBe('all')
    symbols.setDensity('key')
    expect(symbols.getDensity()).toBe('key')
  })

  it('attach wraps key words at default (key) density', () => {
    // 'eat' is in KEY_SYMBOL_WORDS; 'some' and 'cereal' are not
    const container = makeContainer('<p>I eat some cereal.</p>')
    symbols.attach(container)
    const wrappers = container.querySelectorAll('.cp-symbol-word')
    expect(wrappers.length).toBe(1)
    expect(wrappers[0].querySelector('.cp-symbol-text')?.textContent).toBe('eat')
  })

  it('attach wraps more words at all density', () => {
    symbols.setDensity('all')
    // 'work' is in ALL_SYMBOL_MAP but not KEY_SYMBOL_WORDS
    const container = makeContainer('<p>I go to work.</p>')
    symbols.attach(container)
    const wrappers = container.querySelectorAll('.cp-symbol-word')
    // 'go' is in key, 'work' is in all
    expect(wrappers.length).toBe(2)
  })

  it('attach at key density does not wrap non-key words', () => {
    symbols.setDensity('key')
    // 'work' is in ALL_SYMBOL_MAP but NOT in KEY_SYMBOL_WORDS
    const container = makeContainer('<p>I work hard.</p>')
    symbols.attach(container)
    const wrappers = container.querySelectorAll('.cp-symbol-word')
    expect(wrappers.length).toBe(0)
  })

  it('attach creates img with chrome.runtime.getURL src', () => {
    const container = makeContainer('<p>I want to eat.</p>')
    symbols.attach(container)
    const imgs = container.querySelectorAll('.cp-symbol-img')
    // 'want' and 'eat' are both in KEY_SYMBOL_WORDS
    expect(imgs.length).toBeGreaterThan(0)
    const eatImg = Array.from(imgs).find((img) =>
      img.getAttribute('src')?.includes('eat.png'),
    ) as HTMLImageElement
    expect(eatImg).toBeDefined()
    expect(eatImg.getAttribute('aria-hidden')).toBe('true')
  })

  it('attach creates .cp-symbol-text span with original word text', () => {
    const container = makeContainer('<p>Go home!</p>')
    symbols.attach(container)
    const texts = container.querySelectorAll('.cp-symbol-text')
    const wordTexts = Array.from(texts).map((t) => t.textContent)
    expect(wordTexts).toContain('Go')
    expect(wordTexts).toContain('home!')
  })

  it('attach handles punctuation attached to word', () => {
    // 'eat' is a key word; 'eat!' should still match via stripping punctuation
    const container = makeContainer('<p>I eat!</p>')
    symbols.attach(container)
    const wrappers = container.querySelectorAll('.cp-symbol-word')
    expect(wrappers.length).toBe(1)
    // 'eat!' strips to 'eat' for lookup; original text preserved
    expect(wrappers[0].querySelector('.cp-symbol-text')?.textContent).toBe('eat!')
  })

  it('attach skips unknown words', () => {
    const container = makeContainer('<p>The quick brown fox.</p>')
    symbols.attach(container)
    expect(container.querySelectorAll('.cp-symbol-word').length).toBe(0)
  })

  it('attach injects a style tag into document.head', () => {
    const container = makeContainer('<p>eat</p>')
    symbols.attach(container)
    expect(document.getElementById('cp-symbol-styles')).not.toBeNull()
  })

  it('attach does not duplicate the style tag on re-attach', () => {
    const container = makeContainer('<p>eat</p>')
    symbols.attach(container)
    symbols.attach(container)
    expect(document.querySelectorAll('#cp-symbol-styles').length).toBe(1)
  })

  it('detach unwraps words back to text', () => {
    const container = makeContainer('<p>I want to eat now.</p>')
    symbols.attach(container)
    expect(container.querySelectorAll('.cp-symbol-word').length).toBeGreaterThan(0)
    symbols.detach()
    expect(container.querySelectorAll('.cp-symbol-word').length).toBe(0)
    expect(container.textContent).toContain('want')
    expect(container.textContent).toContain('eat')
  })

  it('detach removes the injected style tag', () => {
    const container = makeContainer('<p>eat</p>')
    symbols.attach(container)
    expect(document.getElementById('cp-symbol-styles')).not.toBeNull()
    symbols.detach()
    expect(document.getElementById('cp-symbol-styles')).toBeNull()
  })

  it('detach when not attached is a no-op', () => {
    expect(() => symbols.detach()).not.toThrow()
  })

  it('re-attach detaches first (no double-wrap)', () => {
    const container = makeContainer('<p>eat</p>')
    symbols.attach(container)
    symbols.attach(container)
    expect(container.querySelectorAll('.cp-symbol-word').length).toBe(1)
  })

  it('preserves trailing text after the last matched word', () => {
    // Text node ending with a space triggers the lastIdx < text.length branch
    const p = document.createElement('p')
    p.appendChild(document.createTextNode('I eat '))
    document.body.appendChild(p)
    symbols.attach(p)
    expect(p.textContent).toBe('I eat ')
    expect(p.querySelectorAll('.cp-symbol-word').length).toBe(1)
  })

  it('attach skips text inside script elements', () => {
    const container = document.createElement('div')
    const script = document.createElement('script')
    script.textContent = 'var eat = 1'
    container.appendChild(script)
    document.body.appendChild(container)
    symbols.attach(container)
    expect(container.querySelectorAll('.cp-symbol-word').length).toBe(0)
  })
})
