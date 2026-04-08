import { describe, it, expect, beforeEach } from 'vitest'
import * as complexity from '../../src/content/complexity'

function makeContainer(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

describe('complexity', () => {
  beforeEach(() => {
    complexity.init()
    document.body.innerHTML = ''
  })

  it('init resets enabled to false', () => {
    expect(complexity.isEnabled()).toBe(false)
  })

  it('isEnabled reflects setEnabled', () => {
    complexity.setEnabled(true)
    expect(complexity.isEnabled()).toBe(true)
    complexity.setEnabled(false)
    expect(complexity.isEnabled()).toBe(false)
  })

  it('attach wraps known complex words in cp-complex spans', () => {
    const container = makeContainer('<p>Please utilize the form.</p>')
    complexity.attach(container)
    const spans = container.querySelectorAll('.cp-complex')
    expect(spans.length).toBe(1)
    expect(spans[0].textContent).toBe('utilize')
    expect((spans[0] as HTMLElement).dataset.simpler).toBe('use')
  })

  it('attach is case-insensitive', () => {
    const container = makeContainer('<p>You should Utilize this tool.</p>')
    complexity.attach(container)
    const spans = container.querySelectorAll('.cp-complex')
    expect(spans.length).toBe(1)
    expect(spans[0].textContent).toBe('Utilize')
  })

  it('attach handles punctuation attached to word', () => {
    const container = makeContainer('<p>We must terminate.</p>')
    complexity.attach(container)
    const spans = container.querySelectorAll('.cp-complex')
    expect(spans.length).toBe(1)
    expect(spans[0].textContent).toBe('terminate.')
    expect((spans[0] as HTMLElement).dataset.simpler).toBe('end')
  })

  it('attach does not wrap unknown words', () => {
    const container = makeContainer('<p>The cat sat on the mat.</p>')
    complexity.attach(container)
    expect(container.querySelectorAll('.cp-complex').length).toBe(0)
  })

  it('attach wraps multiple matches in same text node', () => {
    const container = makeContainer('<p>Please utilize and endeavor to assist.</p>')
    complexity.attach(container)
    const spans = container.querySelectorAll('.cp-complex')
    expect(spans.length).toBe(3)
  })

  it('detach unwraps spans back to text nodes', () => {
    const container = makeContainer('<p>We should utilize this.</p>')
    complexity.attach(container)
    expect(container.querySelectorAll('.cp-complex').length).toBe(1)
    complexity.detach()
    expect(container.querySelectorAll('.cp-complex').length).toBe(0)
    expect(container.textContent).toContain('utilize')
  })

  it('detach when not attached is a no-op', () => {
    expect(() => complexity.detach()).not.toThrow()
  })

  it('detach clears container reference (re-detach is safe)', () => {
    const container = makeContainer('<p>utilize</p>')
    complexity.attach(container)
    complexity.detach()
    expect(() => complexity.detach()).not.toThrow()
  })

  it('attach on empty container does not throw', () => {
    const container = makeContainer('')
    expect(() => complexity.attach(container)).not.toThrow()
  })

  it('attach re-attach detaches first', () => {
    const container = makeContainer('<p>utilize</p>')
    complexity.attach(container)
    complexity.attach(container)
    // Should not double-wrap
    const spans = container.querySelectorAll('.cp-complex')
    expect(spans.length).toBe(1)
  })

  it('preserves surrounding text when wrapping', () => {
    const container = makeContainer('<p>Please utilize this now.</p>')
    complexity.attach(container)
    expect(container.textContent).toBe('Please utilize this now.')
  })

  it('preserves trailing whitespace after the last word', () => {
    // Trailing space triggers the lastIdx < text.length branch
    const p = document.createElement('p')
    p.appendChild(document.createTextNode('utilize '))
    document.body.appendChild(p)
    complexity.attach(p)
    expect(p.textContent).toBe('utilize ')
    expect(p.querySelectorAll('.cp-complex').length).toBe(1)
  })
})
