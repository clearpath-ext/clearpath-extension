import { describe, it, expect, beforeEach } from 'vitest'
import * as highlighter from '../../src/content/highlighter'

function makeContainer(html: string): HTMLElement {
  const div = document.createElement('div')
  div.innerHTML = html
  document.body.appendChild(div)
  return div
}

describe('highlighter', () => {
  beforeEach(() => {
    highlighter.init()
    document.body.innerHTML = ''
  })

  // ── init ───────────────────────────────────────────────────────────────────

  it('init() does not throw', () => {
    expect(() => highlighter.init()).not.toThrow()
  })

  // ── attach ─────────────────────────────────────────────────────────────────

  it('wraps words in .cp-word spans', () => {
    const container = makeContainer('<p>Hello world</p>')
    highlighter.attach(container, 'Hello world')
    const spans = container.querySelectorAll('.cp-word')
    expect(spans).toHaveLength(2)
    expect(spans[0].textContent).toBe('Hello')
    expect(spans[1].textContent).toBe('world')
  })

  it('preserves whitespace between words', () => {
    const container = makeContainer('<p>one two</p>')
    highlighter.attach(container, 'one two')
    // Text node between spans should contain whitespace
    const p = container.querySelector('p')!
    const allText = Array.from(p.childNodes)
      .map((n) => n.textContent)
      .join('')
    expect(allText).toBe('one two')
  })

  it('preserves trailing whitespace after the last word in a text node', () => {
    const container = document.createElement('div')
    container.appendChild(document.createTextNode('hello '))
    document.body.appendChild(container)
    highlighter.attach(container, 'hello')
    expect(container.querySelector('.cp-word')?.textContent).toBe('hello')
    // Original trailing space is preserved as a text node after the span
    expect(container.textContent).toBe('hello ')
  })

  it('skips whitespace-only text nodes', () => {
    const container = document.createElement('div')
    container.appendChild(document.createTextNode('   '))
    document.body.appendChild(container)
    highlighter.attach(container, '')
    expect(container.querySelectorAll('.cp-word')).toHaveLength(0)
  })

  it('calls detach() first so previous spans are cleared on re-attach', () => {
    const container = makeContainer('<p>foo bar</p>')
    highlighter.attach(container, 'foo bar')
    // Re-attach: should rebuild spans, not double-wrap
    highlighter.attach(container, 'foo bar')
    const spans = container.querySelectorAll('.cp-word')
    expect(spans).toHaveLength(2)
  })

  // ── onWordBoundary ─────────────────────────────────────────────────────────

  it('is a no-op when no attach has been called', () => {
    expect(() => highlighter.onWordBoundary(0, 'hello')).not.toThrow()
  })

  it('highlights the word at charIndex 0', () => {
    const container = makeContainer('<p>one two three</p>')
    highlighter.attach(container, 'one two three')
    highlighter.onWordBoundary(0, 'one two three')
    const active = container.querySelector('.cp-active')
    expect(active?.textContent).toBe('one')
  })

  it('highlights the second word when charIndex points into it', () => {
    const container = makeContainer('<p>one two three</p>')
    const text = 'one two three'
    highlighter.attach(container, text)
    // 'two' starts at index 4
    highlighter.onWordBoundary(4, text)
    const active = container.querySelector('.cp-active')
    expect(active?.textContent).toBe('two')
  })

  it('highlights the last word', () => {
    const container = makeContainer('<p>one two three</p>')
    const text = 'one two three'
    highlighter.attach(container, text)
    // 'three' starts at index 8
    highlighter.onWordBoundary(8, text)
    const active = container.querySelector('.cp-active')
    expect(active?.textContent).toBe('three')
  })

  it('removes previous highlight before adding the new one', () => {
    const container = makeContainer('<p>one two</p>')
    const text = 'one two'
    highlighter.attach(container, text)
    highlighter.onWordBoundary(0, text) // highlight 'one'
    highlighter.onWordBoundary(4, text) // highlight 'two'
    const actives = container.querySelectorAll('.cp-active')
    expect(actives).toHaveLength(1)
    expect(actives[0].textContent).toBe('two')
  })

  it('does not re-highlight the same span when called with the same charIndex', () => {
    const container = makeContainer('<p>hello world</p>')
    const text = 'hello world'
    highlighter.attach(container, text)
    highlighter.onWordBoundary(0, text)
    const span = container.querySelector('.cp-active') as HTMLSpanElement
    // Spy on classList.remove — should not be called if same span
    const removeSpy = vi.spyOn(span.classList, 'remove')
    highlighter.onWordBoundary(0, text)
    expect(removeSpy).not.toHaveBeenCalled()
  })

  // ── clear ──────────────────────────────────────────────────────────────────

  it('clear() removes the active highlight', () => {
    const container = makeContainer('<p>hello</p>')
    highlighter.attach(container, 'hello')
    highlighter.onWordBoundary(0, 'hello')
    expect(container.querySelector('.cp-active')).toBeTruthy()
    highlighter.clear()
    expect(container.querySelector('.cp-active')).toBeNull()
  })

  it('clear() is a no-op when nothing is highlighted', () => {
    expect(() => highlighter.clear()).not.toThrow()
  })

  // ── detach ─────────────────────────────────────────────────────────────────

  it('detach() clears state so subsequent onWordBoundary calls are no-ops', () => {
    const container = makeContainer('<p>hello</p>')
    highlighter.attach(container, 'hello')
    highlighter.detach()
    expect(() => highlighter.onWordBoundary(0, 'hello')).not.toThrow()
    expect(container.querySelector('.cp-active')).toBeNull()
  })

  it('detach() on already-detached state does not throw', () => {
    expect(() => highlighter.detach()).not.toThrow()
  })
})
