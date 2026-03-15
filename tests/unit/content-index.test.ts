import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures mock factory variables are available when vi.mock is hoisted
const { mockTts, mockToolbar, mockHighlighter } = vi.hoisted(() => {
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
    clear: vi.fn(),
    onWordBoundary: vi.fn(),
  }
  return { mockTts, mockToolbar, mockHighlighter }
})

vi.mock('../../src/content/tts', () => mockTts)
vi.mock('../../src/content/toolbar', () => mockToolbar)
vi.mock('../../src/content/highlighter', () => mockHighlighter)

// Import coordinator after mocks are in place — registers message listener
import '../../src/content/index'

type MessageListener = (
  msg: Record<string, unknown>,
  sender: unknown,
  sendResponse: (r: unknown) => void,
) => boolean | void

// Capture before any vi.clearAllMocks() runs
const messageListener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]
  ?.[0] as MessageListener | undefined

describe('content/index message handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTts.speak.mockResolvedValue(undefined)
    mockTts.getState.mockReturnValue('idle')
    document.body.innerHTML = ''
  })

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
  })

  describe('TTS_SPEAK_PAGE', () => {
    it('extracts visible text and speaks it', async () => {
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
})
