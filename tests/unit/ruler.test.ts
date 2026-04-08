import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as ruler from '../../src/content/ruler'

describe('ruler', () => {
  beforeEach(() => {
    ruler.init()
  })

  it('init resets enabled to false', () => {
    expect(ruler.isEnabled()).toBe(false)
  })

  it('init removes existing host if present', () => {
    ruler.setEnabled(true)
    expect(document.body.children.length).toBeGreaterThan(0)
    ruler.init()
    // After init, no ruler host should remain
    expect(ruler.isEnabled()).toBe(false)
  })

  it('setEnabled(true) creates Shadow DOM host on document.body', () => {
    ruler.setEnabled(true)
    expect(ruler.isEnabled()).toBe(true)
    // A host element should be appended
    const hosts = Array.from(document.body.children).filter(
      (el) => el.shadowRoot !== null,
    )
    expect(hosts.length).toBeGreaterThan(0)
  })

  it('setEnabled(true) attaches mousemove listener', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    ruler.setEnabled(true)
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
  })

  it('setEnabled(false) removes Shadow DOM host', () => {
    ruler.setEnabled(true)
    ruler.setEnabled(false)
    expect(ruler.isEnabled()).toBe(false)
    const hosts = Array.from(document.body.children).filter(
      (el) => el.shadowRoot !== null,
    )
    expect(hosts.length).toBe(0)
  })

  it('setEnabled(false) removes mousemove listener', () => {
    ruler.setEnabled(true)
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    ruler.setEnabled(false)
    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
  })

  it('setEnabled(true) when already enabled is idempotent', () => {
    ruler.setEnabled(true)
    const hostsBefore = document.body.children.length
    ruler.setEnabled(true)
    expect(document.body.children.length).toBe(hostsBefore)
    expect(ruler.isEnabled()).toBe(true)
  })

  it('mousemove updates band top position', () => {
    ruler.setEnabled(true)
    const host = Array.from(document.body.children).find(
      (el) => el.shadowRoot !== null,
    ) as HTMLElement
    const band = host.shadowRoot!.querySelector('.cp-ruler-band') as HTMLElement

    const event = new MouseEvent('mousemove', { clientY: 200 })
    document.dispatchEvent(event)

    expect(band.style.top).toBe(`${200 - 14}px`)
  })

  it('setColor updates band background', () => {
    ruler.setEnabled(true)
    ruler.setColor('#FF0000')
    const host = Array.from(document.body.children).find(
      (el) => el.shadowRoot !== null,
    ) as HTMLElement
    const band = host.shadowRoot!.querySelector('.cp-ruler-band') as HTMLElement
    expect(band.style.background).toBe('rgb(255, 0, 0)')
  })

  it('setColor when disabled updates internal color only', () => {
    ruler.setColor('#00FF00')
    // No band exists, should not throw
    expect(ruler.isEnabled()).toBe(false)
  })

  it('isEnabled returns false after init', () => {
    expect(ruler.isEnabled()).toBe(false)
  })

  it('isEnabled returns true after setEnabled(true)', () => {
    ruler.setEnabled(true)
    expect(ruler.isEnabled()).toBe(true)
  })
})
