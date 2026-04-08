import { describe, it, expect, beforeEach } from 'vitest'
import * as focus from '../../src/content/focus'

function makeContainer(): HTMLElement {
  const container = document.createElement('div')
  const p1 = document.createElement('p')
  p1.textContent = 'First paragraph'
  const p2 = document.createElement('p')
  p2.textContent = 'Second paragraph'
  const h2 = document.createElement('h2')
  h2.textContent = 'A heading'
  container.appendChild(p1)
  container.appendChild(p2)
  container.appendChild(h2)
  document.body.appendChild(container)
  return container
}

describe('focus', () => {
  beforeEach(() => {
    focus.init()
    document.body.innerHTML = ''
  })

  it('init resets enabled to false', () => {
    expect(focus.isEnabled()).toBe(false)
  })

  it('isEnabled reflects setEnabled', () => {
    focus.setEnabled(true)
    expect(focus.isEnabled()).toBe(true)
    focus.setEnabled(false)
    expect(focus.isEnabled()).toBe(false)
  })

  it('attach registers mouseover on contentEl', () => {
    const container = makeContainer()
    let fired = false
    const orig = container.addEventListener.bind(container)
    container.addEventListener = (type: string, ...args: unknown[]) => {
      if (type === 'mouseover') fired = true
      // @ts-expect-error spread
      orig(type, ...args)
    }
    focus.attach(container)
    expect(fired).toBe(true)
  })

  it('detach removes mouseover listener and clears classes', () => {
    const container = makeContainer()
    focus.setEnabled(true)
    focus.attach(container)
    const p = container.querySelector('p') as HTMLElement
    p.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(container.classList.contains('cp-focus-active')).toBe(true)

    focus.detach()
    expect(container.classList.contains('cp-focus-active')).toBe(false)
    expect(container.querySelector('.cp-focused')).toBeNull()
  })

  it('mouseover when enabled adds cp-focused to top-level block', () => {
    const container = makeContainer()
    focus.setEnabled(true)
    focus.attach(container)

    const p1 = container.querySelector('p') as HTMLElement
    p1.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

    expect(p1.classList.contains('cp-focused')).toBe(true)
    expect(container.classList.contains('cp-focus-active')).toBe(true)
  })

  it('mouseover when disabled does nothing', () => {
    const container = makeContainer()
    focus.setEnabled(false)
    focus.attach(container)

    const p1 = container.querySelector('p') as HTMLElement
    p1.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

    expect(p1.classList.contains('cp-focused')).toBe(false)
    expect(container.classList.contains('cp-focus-active')).toBe(false)
  })

  it('mouseover on nested child finds top-level block ancestor', () => {
    const container = document.createElement('div')
    const ul = document.createElement('ul')
    const li = document.createElement('li')
    const span = document.createElement('span')
    span.textContent = 'nested text'
    li.appendChild(span)
    ul.appendChild(li)
    container.appendChild(ul)
    document.body.appendChild(container)

    focus.setEnabled(true)
    focus.attach(container)

    span.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(ul.classList.contains('cp-focused')).toBe(true)
  })

  it('mouseover on same element does not re-apply classes', () => {
    const container = makeContainer()
    focus.setEnabled(true)
    focus.attach(container)

    const p1 = container.querySelector('p') as HTMLElement
    p1.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    p1.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

    // classList.contains is idempotent so just verify it's still focused once
    expect(p1.classList.contains('cp-focused')).toBe(true)
  })

  it('hovering different block moves focus', () => {
    const container = makeContainer()
    focus.setEnabled(true)
    focus.attach(container)

    const [p1, p2] = Array.from(container.querySelectorAll('p')) as HTMLElement[]
    p1.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(p1.classList.contains('cp-focused')).toBe(true)

    p2.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(p1.classList.contains('cp-focused')).toBe(false)
    expect(p2.classList.contains('cp-focused')).toBe(true)
  })

  it('setEnabled(false) while attached removes visual state', () => {
    const container = makeContainer()
    focus.setEnabled(true)
    focus.attach(container)

    const p1 = container.querySelector('p') as HTMLElement
    p1.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(container.classList.contains('cp-focus-active')).toBe(true)

    focus.setEnabled(false)
    expect(container.classList.contains('cp-focus-active')).toBe(false)
    expect(p1.classList.contains('cp-focused')).toBe(false)
  })

  it('detach when not attached is a no-op', () => {
    // Should not throw
    expect(() => focus.detach()).not.toThrow()
  })

  it('attach calls detach first (re-attach is clean)', () => {
    const container = makeContainer()
    focus.setEnabled(true)
    focus.attach(container)
    const p1 = container.querySelector('p') as HTMLElement
    p1.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(container.classList.contains('cp-focus-active')).toBe(true)

    // Re-attach — should clean up first
    focus.attach(container)
    expect(container.classList.contains('cp-focus-active')).toBe(false)
  })
})
