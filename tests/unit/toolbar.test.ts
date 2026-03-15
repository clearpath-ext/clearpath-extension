import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as toolbar from '../../src/content/toolbar'

const callbacks = {
  onPlayPause: vi.fn(),
  onStop: vi.fn(),
}

describe('toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    // Reset module state between tests by calling destroy()
    toolbar.destroy()
  })

  describe('init()', () => {
    it('appends a host element to document.body', () => {
      toolbar.init(callbacks)
      expect(document.body.querySelector('#clearpath-toolbar-host')).not.toBeNull()
    })

    it('attaches a shadow root to the host', () => {
      toolbar.init(callbacks)
      const host = document.body.querySelector('#clearpath-toolbar-host')
      expect(host?.shadowRoot).not.toBeNull()
    })

    it('starts hidden', () => {
      toolbar.init(callbacks)
      const host = document.body.querySelector('#clearpath-toolbar-host') as HTMLElement
      expect(host.style.display).toBe('none')
    })

    it('is idempotent — calling twice does not create a second host', () => {
      toolbar.init(callbacks)
      toolbar.init(callbacks)
      expect(document.body.querySelectorAll('#clearpath-toolbar-host')).toHaveLength(1)
    })
  })

  describe('show() / hide()', () => {
    beforeEach(() => toolbar.init(callbacks))

    it('show() makes the host visible', () => {
      toolbar.show('playing')
      const host = document.body.querySelector('#clearpath-toolbar-host') as HTMLElement
      expect(host.style.display).toBe('block')
    })

    it('hide() hides the host', () => {
      toolbar.show('playing')
      toolbar.hide()
      const host = document.body.querySelector('#clearpath-toolbar-host') as HTMLElement
      expect(host.style.display).toBe('none')
    })

    it('show() and hide() are no-ops before init()', () => {
      toolbar.destroy() // ensure clean state
      expect(() => toolbar.show('playing')).not.toThrow()
      expect(() => toolbar.hide()).not.toThrow()
    })
  })

  describe('updateState()', () => {
    beforeEach(() => toolbar.init(callbacks))

    it('sets aria-label to "Pause" when playing', () => {
      toolbar.show('playing')
      const btn = document.body
        .querySelector('#clearpath-toolbar-host')
        ?.shadowRoot?.getElementById('cp-playpause')
      expect(btn?.getAttribute('aria-label')).toBe('Pause')
    })

    it('sets aria-label to "Resume reading" when paused', () => {
      toolbar.show('playing')
      toolbar.updateState('paused')
      const btn = document.body
        .querySelector('#clearpath-toolbar-host')
        ?.shadowRoot?.getElementById('cp-playpause')
      expect(btn?.getAttribute('aria-label')).toBe('Resume reading')
    })
  })

  describe('button callbacks', () => {
    beforeEach(() => toolbar.init(callbacks))

    it('play/pause button fires onPlayPause', () => {
      toolbar.show('playing')
      const btn = document.body
        .querySelector('#clearpath-toolbar-host')
        ?.shadowRoot?.getElementById('cp-playpause') as HTMLButtonElement
      btn.click()
      expect(callbacks.onPlayPause).toHaveBeenCalledOnce()
    })

    it('stop button fires onStop', () => {
      toolbar.show('playing')
      const btn = document.body
        .querySelector('#clearpath-toolbar-host')
        ?.shadowRoot?.getElementById('cp-stop') as HTMLButtonElement
      btn.click()
      expect(callbacks.onStop).toHaveBeenCalledOnce()
    })
  })

  describe('destroy()', () => {
    it('removes the host element from the DOM', () => {
      toolbar.init(callbacks)
      expect(document.body.querySelector('#clearpath-toolbar-host')).not.toBeNull()
      toolbar.destroy()
      expect(document.body.querySelector('#clearpath-toolbar-host')).toBeNull()
    })

    it('allows init() to create a fresh host after destroy()', () => {
      toolbar.init(callbacks)
      toolbar.destroy()
      toolbar.init(callbacks)
      expect(document.body.querySelectorAll('#clearpath-toolbar-host')).toHaveLength(1)
    })
  })
})
