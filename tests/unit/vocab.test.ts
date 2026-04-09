import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as vocab from '../../src/content/vocab'

// Minimal dictionary for tests
const MOCK_DICT = {
  eat: 'If you eat something, you put it in your mouth and swallow it.',
  happy: 'When you feel happy, you feel good.',
  run: 'If you run, you go quickly on foot.',
}

function mockFetch(dict: Record<string, string> = MOCK_DICT) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(dict),
    }),
  )
}

function triggerDblClick(x = 100, y = 200) {
  const event = new MouseEvent('dblclick', { clientX: x, clientY: y, bubbles: true })
  document.dispatchEvent(event)
  return event
}

function triggerClick(target: EventTarget = document) {
  const event = new MouseEvent('click', { bubbles: true })
  ;(target as Element).dispatchEvent(event)
  return event
}

function setSelection(text: string) {
  // jsdom getSelection stub — replace toString
  const sel = { toString: () => text }
  vi.spyOn(window, 'getSelection').mockReturnValue(sel as unknown as Selection)
}

describe('vocab', () => {
  beforeEach(() => {
    vocab.init()
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.mocked(chrome.runtime.getURL).mockReturnValue('chrome-extension://test/dictionary.json')
    mockFetch()
  })

  // ── State ──────────────────────────────────────────────────────────────────

  it('init resets enabled to false', () => {
    vocab.setEnabled(true)
    vocab.init()
    expect(vocab.isEnabled()).toBe(false)
  })

  it('isEnabled reflects setEnabled', () => {
    expect(vocab.isEnabled()).toBe(false)
    vocab.setEnabled(true)
    expect(vocab.isEnabled()).toBe(true)
    vocab.setEnabled(false)
    expect(vocab.isEnabled()).toBe(false)
  })

  // ── Dictionary loading ─────────────────────────────────────────────────────

  it('loads the dictionary lazily on first dblclick', async () => {
    vocab.setEnabled(true)
    expect(fetch).not.toHaveBeenCalled()

    setSelection('eat')
    triggerDblClick()

    // Flush microtasks so fetch resolves
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('chrome-extension://test/dictionary.json')
    })
  })

  it('does not reload the dictionary on subsequent dblclicks', async () => {
    vocab.setEnabled(true)
    setSelection('eat')

    triggerDblClick()
    await vi.waitFor(() => document.getElementById('cp-vocab-tooltip-host'))

    triggerDblClick()
    await vi.waitFor(() => document.getElementById('cp-vocab-tooltip-host'))

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('resets dictionaryPromise on init', async () => {
    vocab.setEnabled(true)
    setSelection('eat')
    triggerDblClick()
    await vi.waitFor(() => document.getElementById('cp-vocab-tooltip-host'))

    vocab.init()
    vocab.setEnabled(true)
    setSelection('eat')
    triggerDblClick()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  })

  // ── Tooltip ────────────────────────────────────────────────────────────────

  it('shows a tooltip with the word and definition on dblclick', async () => {
    vocab.setEnabled(true)
    setSelection('eat')
    triggerDblClick()

    await vi.waitFor(() => {
      const host = document.getElementById('cp-vocab-tooltip-host')
      expect(host).not.toBeNull()
      const shadow = host!.shadowRoot!
      expect(shadow.querySelector('.word')?.textContent).toBe('eat')
      expect(shadow.querySelector('.def')?.textContent).toContain('put it in your mouth')
    })
  })

  it('shows definition for a word with trailing punctuation', async () => {
    vocab.setEnabled(true)
    setSelection('eat!')
    triggerDblClick()

    await vi.waitFor(() => {
      expect(document.getElementById('cp-vocab-tooltip-host')).not.toBeNull()
    })
  })

  it('shows definition for a mixed-case selection', async () => {
    vocab.setEnabled(true)
    setSelection('Happy')
    triggerDblClick()

    await vi.waitFor(() => {
      const host = document.getElementById('cp-vocab-tooltip-host')
      expect(host).not.toBeNull()
    })
  })

  it('does not show tooltip for an unknown word', async () => {
    vocab.setEnabled(true)
    setSelection('xyzfoo')
    triggerDblClick()

    await new Promise((r) => setTimeout(r, 50))
    expect(document.getElementById('cp-vocab-tooltip-host')).toBeNull()
  })

  it('does not show tooltip when selection is empty', async () => {
    vocab.setEnabled(true)
    setSelection('')
    triggerDblClick()

    await new Promise((r) => setTimeout(r, 50))
    expect(document.getElementById('cp-vocab-tooltip-host')).toBeNull()
  })

  it('does not show tooltip for a multi-word selection', async () => {
    vocab.setEnabled(true)
    setSelection('eat food')
    triggerDblClick()

    await new Promise((r) => setTimeout(r, 50))
    expect(document.getElementById('cp-vocab-tooltip-host')).toBeNull()
  })

  it('does not show tooltip when getSelection returns null', async () => {
    vocab.setEnabled(true)
    vi.spyOn(window, 'getSelection').mockReturnValue(null)
    triggerDblClick()

    await new Promise((r) => setTimeout(r, 50))
    expect(document.getElementById('cp-vocab-tooltip-host')).toBeNull()
  })

  it('replaces an existing tooltip on a new dblclick', async () => {
    vocab.setEnabled(true)
    setSelection('eat')
    triggerDblClick()
    await vi.waitFor(() => document.getElementById('cp-vocab-tooltip-host'))

    setSelection('happy')
    triggerDblClick()
    await vi.waitFor(() => {
      const hosts = document.querySelectorAll('#cp-vocab-tooltip-host')
      expect(hosts.length).toBe(1)
      expect(hosts[0].shadowRoot!.querySelector('.word')?.textContent).toBe('happy')
    })
  })

  // ── Dismiss ────────────────────────────────────────────────────────────────

  it('hides the tooltip when Escape is pressed', async () => {
    vocab.setEnabled(true)
    setSelection('eat')
    triggerDblClick()
    await vi.waitFor(() => document.getElementById('cp-vocab-tooltip-host'))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.getElementById('cp-vocab-tooltip-host')).toBeNull()
  })

  it('hides the tooltip on a click outside', async () => {
    vocab.setEnabled(true)
    setSelection('eat')
    triggerDblClick()
    await vi.waitFor(() => document.getElementById('cp-vocab-tooltip-host'))

    triggerClick(document.body)
    expect(document.getElementById('cp-vocab-tooltip-host')).toBeNull()
  })

  it('dismissClickHandler is a no-op when no tooltip is visible', () => {
    vocab.setEnabled(true)
    // No double-click — no tooltip shown yet
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(document.getElementById('cp-vocab-tooltip-host')).toBeNull()
  })

  it('does not hide the tooltip when clicking on the host element itself', async () => {
    vocab.setEnabled(true)
    setSelection('eat')
    triggerDblClick()

    // Capture the host element and dispatch the click inside waitFor
    // to avoid a race with requestAnimationFrame between waitFor and getElementById
    await vi.waitFor(() => {
      const host = document.getElementById('cp-vocab-tooltip-host')
      if (!host) throw new Error('Tooltip not yet shown')
      host.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(document.getElementById('cp-vocab-tooltip-host')).not.toBeNull()
    })
  })

  // ── Enable / disable ───────────────────────────────────────────────────────

  it('does not respond to dblclick when disabled', async () => {
    vocab.setEnabled(true)
    vocab.setEnabled(false)
    setSelection('eat')
    triggerDblClick()

    await new Promise((r) => setTimeout(r, 50))
    expect(fetch).not.toHaveBeenCalled()
    expect(document.getElementById('cp-vocab-tooltip-host')).toBeNull()
  })

  it('detach removes all listeners and hides tooltip', async () => {
    vocab.setEnabled(true)
    setSelection('eat')
    triggerDblClick()
    await vi.waitFor(() => document.getElementById('cp-vocab-tooltip-host'))

    vocab.setEnabled(false)
    expect(document.getElementById('cp-vocab-tooltip-host')).toBeNull()

    // Listeners are gone — dblclick no longer fires fetch
    const callsBefore = vi.mocked(fetch).mock.calls.length
    triggerDblClick()
    await new Promise((r) => setTimeout(r, 50))
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore)
  })

  it('calling init() while attached is a no-op for listeners', () => {
    vocab.setEnabled(true)
    // Second attach should be a no-op (guard inside attach)
    vocab.setEnabled(true)
    vocab.init()
    // Should not throw
  })

  it('detach when not attached is a no-op', () => {
    expect(() => vocab.setEnabled(false)).not.toThrow()
  })

  it('Escape and click-outside listeners are cleaned up on detach', async () => {
    vocab.setEnabled(true)
    setSelection('eat')
    triggerDblClick()
    await vi.waitFor(() => document.getElementById('cp-vocab-tooltip-host'))

    vocab.setEnabled(false)

    // Pressing Escape after detach should not throw
    expect(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    ).not.toThrow()
  })
})
