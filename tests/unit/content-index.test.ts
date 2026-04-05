import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TTSState } from '../../src/shared/types'

// vi.hoisted ensures mock factory variables are available when vi.mock is hoisted
const { mockTts, mockToolbar, mockHighlighter, mockOverlay, mockReader } = vi.hoisted(() => {
  const mockTts = {
    init: vi.fn(),
    speak: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    getState: vi.fn().mockReturnValue('idle' as const),
    getVoices: vi.fn().mockReturnValue([]),
  }
  const mockToolbar = {
    init: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    updateState: vi.fn(),
    destroy: vi.fn(),
  }
  const mockHighlighter = {
    init: vi.fn(),
    attach: vi.fn(),
    clear: vi.fn(),
    detach: vi.fn(),
    onWordBoundary: vi.fn(),
  }
  const mockOverlay = {
    init: vi.fn(),
    showLoading: vi.fn(),
    showResult: vi.fn(),
    showError: vi.fn(),
    hide: vi.fn(),
    destroy: vi.fn(),
  }
  const mockReader = {
    init: vi.fn(),
    isOpen: vi.fn().mockReturnValue(false),
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    getSpokenText: vi.fn().mockReturnValue(''),
    getContentEl: vi.fn().mockReturnValue(null),
  }
  return { mockTts, mockToolbar, mockHighlighter, mockOverlay, mockReader }
})

vi.mock('../../src/content/tts', () => mockTts)
vi.mock('../../src/content/toolbar', () => mockToolbar)
vi.mock('../../src/content/highlighter', () => mockHighlighter)
vi.mock('../../src/content/overlay', () => mockOverlay)
vi.mock('../../src/content/reader', () => mockReader)

// Import coordinator after mocks are in place — registers message listener
import '../../src/content/index'

type MessageListener = (
  msg: Record<string, unknown>,
  sender: unknown,
  sendResponse: (r: unknown) => void,
) => boolean | void

// Capture all listener references before any vi.clearAllMocks() runs.
// These must be top-level so they execute at module-load time.
const messageListener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]
  ?.[0] as MessageListener | undefined

// Capture the callbacks that content/index.ts passes to tts.init()
const ttsInitArgs = mockTts.init.mock.calls[0] as
  | [(state: TTSState) => void, (charIndex: number, text: string) => void]
  | undefined
const capturedOnStateChange = ttsInitArgs?.[0]
const capturedOnWordBoundary = ttsInitArgs?.[1]

// Capture the callbacks that content/index.ts passes to toolbar.init()
const capturedToolbarCallbacks = mockToolbar.init.mock.calls[0]?.[0] as
  | { onPlayPause: () => void; onStop: () => void }
  | undefined

// Capture the callbacks that content/index.ts passes to reader.init()
const capturedReaderCallbacks = mockReader.init.mock.calls[0]?.[0] as
  | { onClose: () => void }
  | undefined

describe('content/index message handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTts.speak.mockResolvedValue(undefined)
    mockTts.getState.mockReturnValue('idle')
    mockReader.isOpen.mockReturnValue(false)
    mockReader.open.mockResolvedValue(undefined)
    mockReader.getSpokenText.mockReturnValue('')
    mockReader.getContentEl.mockReturnValue(null)
    // Ensure sendMessage always returns a promise so .catch() calls don't throw
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)
    document.body.innerHTML = ''
  })

  // ── Module-level callbacks ─────────────────────────────────────────────────

  describe('onStateChange (passed to tts.init)', () => {
    it('hides toolbar and clears highlights when state is idle', () => {
      capturedOnStateChange?.('idle')
      expect(mockToolbar.hide).toHaveBeenCalled()
      expect(mockHighlighter.clear).toHaveBeenCalled()
    })

    it('shows toolbar and updates state for non-idle states', () => {
      capturedOnStateChange?.('playing')
      expect(mockToolbar.show).toHaveBeenCalledWith('playing')
      expect(mockToolbar.updateState).toHaveBeenCalledWith('playing')
    })

    it('sends TTS_STATE_CHANGED to the background', () => {
      capturedOnStateChange?.('playing')
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'TTS_STATE_CHANGED',
        payload: { state: 'playing' },
      })
    })

    it('swallows sendMessage rejection (popup may be closed)', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('popup closed'))
      expect(() => capturedOnStateChange?.('playing')).not.toThrow()
      await new Promise((r) => setTimeout(r, 0))
    })
  })

  describe('onWordBoundary (passed to tts.init)', () => {
    it('forwards charIndex and text to the highlighter', () => {
      capturedOnWordBoundary?.(5, 'hello world')
      expect(mockHighlighter.onWordBoundary).toHaveBeenCalledWith(5, 'hello world')
    })
  })

  describe('toolbar callbacks (passed to toolbar.init)', () => {
    it('onPlayPause calls tts.pause() when playing', () => {
      mockTts.getState.mockReturnValue('playing')
      capturedToolbarCallbacks?.onPlayPause()
      expect(mockTts.pause).toHaveBeenCalled()
    })

    it('onPlayPause calls tts.resume() when paused', () => {
      mockTts.getState.mockReturnValue('paused')
      capturedToolbarCallbacks?.onPlayPause()
      expect(mockTts.resume).toHaveBeenCalled()
    })

    it('onPlayPause does nothing when idle', () => {
      mockTts.getState.mockReturnValue('idle')
      capturedToolbarCallbacks?.onPlayPause()
      expect(mockTts.pause).not.toHaveBeenCalled()
      expect(mockTts.resume).not.toHaveBeenCalled()
    })

    it('onStop calls tts.stop()', () => {
      capturedToolbarCallbacks?.onStop()
      expect(mockTts.stop).toHaveBeenCalled()
    })
  })

  describe('reader callbacks (passed to reader.init)', () => {
    it('onClose stops TTS, detaches highlighter, and sends READER_STATE_CHANGED false', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)
      capturedReaderCallbacks?.onClose()
      expect(mockTts.stop).toHaveBeenCalled()
      expect(mockHighlighter.detach).toHaveBeenCalled()
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'READER_STATE_CHANGED',
        payload: { enabled: false },
      })
    })

    it('onClose swallows sendMessage rejection', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('popup closed'))
      expect(() => capturedReaderCallbacks?.onClose()).not.toThrow()
      await new Promise((r) => setTimeout(r, 0))
    })
  })

  // ── Message cases ──────────────────────────────────────────────────────────

  describe('TTS_SPEAK_SELECTION', () => {
    it('speaks the currently selected text', async () => {
      Object.defineProperty(window, 'getSelection', {
        value: () => ({ toString: () => 'Hello world' }),
        writable: true,
        configurable: true,
      })

      const sendResponse = vi.fn()
      const result = messageListener?.({ type: 'TTS_SPEAK_SELECTION' }, {}, sendResponse)

      expect(result).toBe(true)
      await new Promise((r) => setTimeout(r, 0))
      expect(mockTts.speak).toHaveBeenCalledWith('Hello world')
      expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: undefined })
    })

    it('responds with error when no text is selected', () => {
      Object.defineProperty(window, 'getSelection', {
        value: () => ({ toString: () => '   ' }),
        writable: true,
        configurable: true,
      })

      const sendResponse = vi.fn()
      messageListener?.({ type: 'TTS_SPEAK_SELECTION' }, {}, sendResponse)

      expect(mockTts.speak).not.toHaveBeenCalled()
      expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'No text selected' })
    })

    it('responds with error when getSelection() returns null', () => {
      Object.defineProperty(window, 'getSelection', {
        value: () => null,
        writable: true,
        configurable: true,
      })

      const sendResponse = vi.fn()
      messageListener?.({ type: 'TTS_SPEAK_SELECTION' }, {}, sendResponse)

      expect(mockTts.speak).not.toHaveBeenCalled()
      expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'No text selected' })
    })
  })

  describe('TTS_SPEAK_PAGE', () => {
    it('extracts visible text and speaks it when reader is closed', async () => {
      document.body.innerHTML = '<p>Hello <span>world</span></p>'

      const sendResponse = vi.fn()
      messageListener?.({ type: 'TTS_SPEAK_PAGE' }, {}, sendResponse)
      await new Promise((r) => setTimeout(r, 0))

      expect(mockTts.speak).toHaveBeenCalledOnce()
      const spokenText = mockTts.speak.mock.calls[0][0] as string
      expect(spokenText).toContain('Hello')
      expect(spokenText).toContain('world')
    })

    it('excludes script and style element text', async () => {
      document.body.innerHTML = `
        <p>Visible text</p>
        <script>var x = 1</script>
        <style>.foo { color: red }</style>
      `

      messageListener?.({ type: 'TTS_SPEAK_PAGE' }, {}, vi.fn())
      await new Promise((r) => setTimeout(r, 0))

      const spokenText = mockTts.speak.mock.calls[0][0] as string
      expect(spokenText).toContain('Visible text')
      expect(spokenText).not.toContain('var x')
      expect(spokenText).not.toContain('.foo')
    })

    it('excludes aria-hidden elements', async () => {
      document.body.innerHTML = `
        <p>Visible text</p>
        <div aria-hidden="true"><p>Decorative text</p></div>
      `

      messageListener?.({ type: 'TTS_SPEAK_PAGE' }, {}, vi.fn())
      await new Promise((r) => setTimeout(r, 0))

      const spokenText = mockTts.speak.mock.calls[0][0] as string
      expect(spokenText).toContain('Visible text')
      expect(spokenText).not.toContain('Decorative text')
    })

    it('excludes display:none elements', async () => {
      document.body.innerHTML = `
        <p>Visible text</p>
        <p style="display:none">Hidden text</p>
      `

      messageListener?.({ type: 'TTS_SPEAK_PAGE' }, {}, vi.fn())
      await new Promise((r) => setTimeout(r, 0))

      const spokenText = mockTts.speak.mock.calls[0][0] as string
      expect(spokenText).toContain('Visible text')
      expect(spokenText).not.toContain('Hidden text')
    })

    it('returns true to keep the channel open for the async response', () => {
      document.body.innerHTML = '<p>text</p>'
      const result = messageListener?.({ type: 'TTS_SPEAK_PAGE' }, {}, vi.fn())
      expect(result).toBe(true)
    })

    it('uses reader text and attaches highlighter when reader is open', async () => {
      mockReader.isOpen.mockReturnValue(true)
      mockReader.getSpokenText.mockReturnValue('reader spoken text')
      const mockContentEl = document.createElement('div')
      mockReader.getContentEl.mockReturnValue(mockContentEl)

      messageListener?.({ type: 'TTS_SPEAK_PAGE' }, {}, vi.fn())
      await new Promise((r) => setTimeout(r, 0))

      expect(mockTts.speak).toHaveBeenCalledWith('reader spoken text')
      expect(mockHighlighter.attach).toHaveBeenCalledWith(mockContentEl, 'reader spoken text')
    })

    it('skips highlighter.attach when reader is open but contentEl is null', async () => {
      mockReader.isOpen.mockReturnValue(true)
      mockReader.getSpokenText.mockReturnValue('reader text')
      mockReader.getContentEl.mockReturnValue(null)

      messageListener?.({ type: 'TTS_SPEAK_PAGE' }, {}, vi.fn())
      await new Promise((r) => setTimeout(r, 0))

      expect(mockTts.speak).toHaveBeenCalledWith('reader text')
      expect(mockHighlighter.attach).not.toHaveBeenCalled()
    })
  })

  describe('TTS_SPEAK', () => {
    it('speaks the given text and responds with ok', async () => {
      const sendResponse = vi.fn()
      const result = messageListener?.(
        { type: 'TTS_SPEAK', payload: { text: 'hello from TTS_SPEAK' } },
        {},
        sendResponse,
      )
      expect(result).toBe(true)
      await new Promise((r) => setTimeout(r, 0))
      expect(mockTts.speak).toHaveBeenCalledWith('hello from TTS_SPEAK')
      expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: undefined })
    })

    it('responds with error when speak rejects', async () => {
      mockTts.speak.mockRejectedValue(new Error('speak failed'))
      const sendResponse = vi.fn()
      messageListener?.(
        { type: 'TTS_SPEAK', payload: { text: 'hello' } },
        {},
        sendResponse,
      )
      await new Promise((r) => setTimeout(r, 0))
      expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'Error: speak failed' })
    })
  })

  describe('TTS_ACTION', () => {
    it('calls tts.pause() for pause action', () => {
      const sendResponse = vi.fn()
      messageListener?.({ type: 'TTS_ACTION', payload: { action: 'pause' } }, {}, sendResponse)
      expect(mockTts.pause).toHaveBeenCalled()
      expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: undefined })
    })

    it('calls tts.resume() for resume action', () => {
      messageListener?.(
        { type: 'TTS_ACTION', payload: { action: 'resume' } },
        {},
        vi.fn(),
      )
      expect(mockTts.resume).toHaveBeenCalled()
    })

    it('calls tts.stop() for stop action', () => {
      messageListener?.({ type: 'TTS_ACTION', payload: { action: 'stop' } }, {}, vi.fn())
      expect(mockTts.stop).toHaveBeenCalled()
    })
  })

  describe('GET_TTS_STATE', () => {
    it('returns the current TTS state', () => {
      mockTts.getState.mockReturnValue('playing')
      const sendResponse = vi.fn()
      messageListener?.({ type: 'GET_TTS_STATE' }, {}, sendResponse)
      expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: 'playing' })
    })
  })

  describe('SIMPLIFY_LOADING', () => {
    it('calls overlay.showLoading()', () => {
      messageListener?.({ type: 'SIMPLIFY_LOADING' }, {}, vi.fn())
      expect(mockOverlay.showLoading).toHaveBeenCalledOnce()
    })
  })

  describe('SIMPLIFY_RESULT', () => {
    it('calls overlay.showResult() with the simplified text', () => {
      messageListener?.(
        { type: 'SIMPLIFY_RESULT', payload: { simplified: 'easy text' } },
        {},
        vi.fn(),
      )
      expect(mockOverlay.showResult).toHaveBeenCalledWith('easy text')
    })
  })

  describe('SIMPLIFY_ERROR', () => {
    it('calls overlay.showError() with the error message', () => {
      messageListener?.(
        { type: 'SIMPLIFY_ERROR', payload: { error: 'oops' } },
        {},
        vi.fn(),
      )
      expect(mockOverlay.showError).toHaveBeenCalledWith('oops')
    })
  })

  describe('TOGGLE_READING_MODE', () => {
    it('closes reader when it is open', () => {
      mockReader.isOpen.mockReturnValue(true)
      const sendResponse = vi.fn()
      messageListener?.({ type: 'TOGGLE_READING_MODE' }, {}, sendResponse)
      expect(mockReader.close).toHaveBeenCalled()
      expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: undefined })
    })

    it('opens reader and sends READER_STATE_CHANGED(true) when reader is closed', async () => {
      mockReader.isOpen.mockReturnValue(false)
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)

      const sendResponse = vi.fn()
      messageListener?.({ type: 'TOGGLE_READING_MODE' }, {}, sendResponse)

      expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: undefined })

      await new Promise((r) => setTimeout(r, 0))

      expect(mockReader.open).toHaveBeenCalled()
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'READER_STATE_CHANGED',
        payload: { enabled: true },
      })
    })

    it('swallows sendMessage rejection after reader opens', async () => {
      mockReader.isOpen.mockReturnValue(false)
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('popup closed'))

      messageListener?.({ type: 'TOGGLE_READING_MODE' }, {}, vi.fn())
      await new Promise((r) => setTimeout(r, 0))
      // No uncaught rejection
    })
  })

  describe('GET_READER_STATE', () => {
    it('returns false when reader is closed', () => {
      mockReader.isOpen.mockReturnValue(false)
      const sendResponse = vi.fn()
      messageListener?.({ type: 'GET_READER_STATE' }, {}, sendResponse)
      expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: false })
    })

    it('returns true when reader is open', () => {
      mockReader.isOpen.mockReturnValue(true)
      const sendResponse = vi.fn()
      messageListener?.({ type: 'GET_READER_STATE' }, {}, sendResponse)
      expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: true })
    })
  })
})
