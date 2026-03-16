import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as overlay from '../../src/content/overlay'

describe('overlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    overlay.destroy()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('init()', () => {
    it('appends a host element to document.body', () => {
      overlay.init()
      expect(document.body.querySelector('#clearpath-overlay-host')).not.toBeNull()
    })

    it('attaches a shadow root to the host', () => {
      overlay.init()
      const host = document.body.querySelector('#clearpath-overlay-host')
      expect(host?.shadowRoot).not.toBeNull()
    })

    it('starts hidden', () => {
      overlay.init()
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      expect(host.style.display).toBe('none')
    })

    it('is idempotent — calling twice does not create a second host', () => {
      overlay.init()
      overlay.init()
      expect(document.body.querySelectorAll('#clearpath-overlay-host')).toHaveLength(1)
    })
  })

  describe('showLoading()', () => {
    beforeEach(() => overlay.init())

    it('shows "Simplifying" text', () => {
      overlay.showLoading()
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      expect(host.shadowRoot?.textContent).toContain('Simplifying')
    })

    it('makes the host visible', () => {
      overlay.showLoading()
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      expect(host.style.display).toBe('block')
    })

    it('is a no-op before init()', () => {
      overlay.destroy()
      expect(() => overlay.showLoading()).not.toThrow()
    })
  })

  describe('showResult()', () => {
    beforeEach(() => overlay.init())

    it('shows the simplified text', () => {
      overlay.showResult('Easy text here')
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      expect(host.shadowRoot?.textContent).toContain('Easy text here')
    })

    it('shows a Copy button', () => {
      overlay.showResult('some text')
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      const btn = host.shadowRoot?.querySelector('.copy-btn') as HTMLButtonElement
      expect(btn).not.toBeNull()
      expect(btn.textContent).toBe('Copy')
    })

    it('makes the host visible', () => {
      overlay.showResult('text')
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      expect(host.style.display).toBe('block')
    })

    it('copy button writes text to clipboard and shows "Copied ✓"', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
        configurable: true,
      })

      overlay.showResult('clipboard text')
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      const btn = host.shadowRoot?.querySelector('.copy-btn') as HTMLButtonElement
      btn.click()
      // Real setTimeout(r, 0) flushes microtasks then resolves
      await new Promise((r) => setTimeout(r, 0))

      expect(writeText).toHaveBeenCalledWith('clipboard text')
      expect(btn.textContent).toBe('Copied \u2713')
    })

    it('copy button label resets to "Copy" after 2s', async () => {
      vi.useFakeTimers()
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
        configurable: true,
      })

      overlay.showResult('text')
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      const btn = host.shadowRoot?.querySelector('.copy-btn') as HTMLButtonElement
      btn.click()

      // Drains the promise microtask queue AND advances all fake timers (including the 2s reset)
      await vi.runAllTimersAsync()

      expect(btn.textContent).toBe('Copy')
    })

    it('copy button handles clipboard rejection silently', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'))
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
        configurable: true,
      })

      overlay.showResult('text')
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      const btn = host.shadowRoot?.querySelector('.copy-btn') as HTMLButtonElement
      expect(() => btn.click()).not.toThrow()
      await new Promise((r) => setTimeout(r, 0))
      // Button label unchanged — rejection was swallowed
      expect(btn.textContent).toBe('Copy')
    })

    it('is a no-op before init()', () => {
      overlay.destroy()
      expect(() => overlay.showResult('text')).not.toThrow()
    })
  })

  describe('showError()', () => {
    beforeEach(() => overlay.init())

    it('shows the error message', () => {
      overlay.showError('Something went wrong')
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      expect(host.shadowRoot?.textContent).toContain('Something went wrong')
    })

    it('makes the host visible', () => {
      overlay.showError('error')
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      expect(host.style.display).toBe('block')
    })

    it('is a no-op before init()', () => {
      overlay.destroy()
      expect(() => overlay.showError('msg')).not.toThrow()
    })
  })

  describe('hide()', () => {
    beforeEach(() => overlay.init())

    it('hides the host after showResult', () => {
      overlay.showResult('text')
      overlay.hide()
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      expect(host.style.display).toBe('none')
    })

    it('is a no-op before init()', () => {
      overlay.destroy()
      expect(() => overlay.hide()).not.toThrow()
    })
  })

  describe('close button', () => {
    beforeEach(() => overlay.init())

    it('clicking close hides the overlay', () => {
      overlay.showResult('text')
      const host = document.body.querySelector('#clearpath-overlay-host') as HTMLElement
      const closeBtn = host.shadowRoot?.querySelector('.close') as HTMLButtonElement
      closeBtn.click()
      expect(host.style.display).toBe('none')
    })
  })

  describe('destroy()', () => {
    it('removes the host from the DOM', () => {
      overlay.init()
      overlay.destroy()
      expect(document.body.querySelector('#clearpath-overlay-host')).toBeNull()
    })

    it('allows re-init after destroy()', () => {
      overlay.init()
      overlay.destroy()
      overlay.init()
      expect(document.body.querySelectorAll('#clearpath-overlay-host')).toHaveLength(1)
    })
  })
})
