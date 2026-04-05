import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const { mockGetSettings, mockSetSettings } = vi.hoisted(() => {
  const mockGetSettings = vi.fn()
  const mockSetSettings = vi.fn().mockResolvedValue(undefined)
  return { mockGetSettings, mockSetSettings }
})

vi.mock('../../src/lib/storage', () => ({
  getSettings: mockGetSettings,
  setSettings: mockSetSettings,
}))

// speechSynthesis mock
const mockGetVoices = vi.fn().mockReturnValue([])
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()
Object.defineProperty(window, 'speechSynthesis', {
  value: {
    getVoices: mockGetVoices,
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
  },
  writable: true,
})

import { Popup } from '../../src/popup/Popup'

const defaultSettings = {
  ttsVoice: '',
  ttsRate: 1.0,
  ttsPitch: 1.0,
  llmProvider: 'none' as const,
  apiKey: '',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
  readingLevel: 5 as const,
  symbolsEnabled: false,
  symbolDensity: 'key' as const,
  readerFont: 'system' as const,
  readerFontSize: 18,
  readerLineHeight: 1.75,
  readerTheme: 'light' as const,
  readerColumnWidth: 'medium' as const,
}

describe('Popup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({ ...defaultSettings })
    mockGetVoices.mockReturnValue([])
    // Default: GET_TTS_STATE → no content; GET_READER_STATE → no content
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ ok: false, error: 'no content' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Loading state ─────────────────────────────────────────────────────────

  it('renders the loading spinner initially', () => {
    mockGetSettings.mockReturnValueOnce(new Promise(() => {}))
    render(<Popup />)
    expect(screen.queryByRole('button', { name: /read page/i })).toBeNull()
  })

  it('shows the Read Page button after settings load', async () => {
    await act(async () => {
      render(<Popup />)
    })
    expect(screen.getByRole('button', { name: /read page/i })).toBeInTheDocument()
  })

  it('applies initial TTS state returned by GET_TTS_STATE on mount', async () => {
    vi.mocked(chrome.runtime.sendMessage)
      .mockResolvedValueOnce({ ok: true, data: 'playing' })  // GET_TTS_STATE
      .mockResolvedValueOnce({ ok: false, error: 'no reader' }) // GET_READER_STATE

    await act(async () => {
      render(<Popup />)
    })

    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
  })

  it('applies initial reader state from GET_READER_STATE on mount', async () => {
    vi.mocked(chrome.runtime.sendMessage)
      .mockResolvedValueOnce({ ok: false, error: 'no tts' })  // GET_TTS_STATE
      .mockResolvedValueOnce({ ok: true, data: true })          // GET_READER_STATE

    await act(async () => {
      render(<Popup />)
    })

    expect(screen.getByRole('button', { name: /exit reading mode/i })).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('handles sendMessage rejection gracefully during settings load', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('not available'))
    await act(async () => {
      render(<Popup />)
    })
    expect(screen.getByRole('button', { name: /read page/i })).toBeInTheDocument()
  })

  // ── Voice settings ────────────────────────────────────────────────────────

  it('populates the voice dropdown from speechSynthesis', async () => {
    mockGetVoices.mockReturnValue([
      { name: 'Google US English' },
      { name: 'Google UK English' },
    ] as SpeechSynthesisVoice[])

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /voice settings/i }))

    expect(screen.getByRole('option', { name: 'Google US English' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Google UK English' })).toBeInTheDocument()
  })

  it('saves selected voice on change', async () => {
    mockGetVoices.mockReturnValue([{ name: 'Samantha' }] as SpeechSynthesisVoice[])

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /voice settings/i }))

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: /voice/i }), {
        target: { value: 'Samantha' },
      })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ ttsVoice: 'Samantha' })
  })

  it('debounces rate slider — setSettings called once after 300ms', async () => {
    vi.useFakeTimers()

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /voice settings/i }))
    const rateSlider = screen.getByRole('slider', { name: /speech speed/i })

    fireEvent.change(rateSlider, { target: { value: '1.2' } })
    fireEvent.change(rateSlider, { target: { value: '1.4' } })
    fireEvent.change(rateSlider, { target: { value: '1.6' } })

    expect(mockSetSettings).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(mockSetSettings).toHaveBeenCalledOnce()
    expect(mockSetSettings).toHaveBeenCalledWith({ ttsRate: 1.6 })
  })

  it('debounces pitch slider — setSettings called once after 300ms', async () => {
    vi.useFakeTimers()

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /voice settings/i }))
    const pitchSlider = screen.getByRole('slider', { name: /speech pitch/i })

    fireEvent.change(pitchSlider, { target: { value: '0.8' } })
    fireEvent.change(pitchSlider, { target: { value: '1.2' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(mockSetSettings).toHaveBeenCalledOnce()
    expect(mockSetSettings).toHaveBeenCalledWith({ ttsPitch: 1.2 })
  })

  // ── TTS actions ───────────────────────────────────────────────────────────

  it('sends TTS_SPEAK_PAGE when Read Page is clicked', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)

    await act(async () => {
      render(<Popup />)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /read page/i }))
    })

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'TTS_SPEAK_PAGE' })
  })

  it('swallows sendMessage rejection when Read Page is clicked (catch block)', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('no tab'))

    await act(async () => {
      render(<Popup />)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /read page/i }))
    })

    expect(screen.getByRole('button', { name: /read page/i })).toBeInTheDocument()
  })

  it('updates UI to active state when TTS_STATE_CHANGED (playing) arrives', async () => {
    await act(async () => {
      render(<Popup />)
    })

    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0]

    await act(async () => {
      listener?.({ type: 'TTS_STATE_CHANGED', payload: { state: 'playing' } }, {}, vi.fn())
    })

    expect(screen.getByText(/reading page/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
  })

  it('shows Resume button when state is paused', async () => {
    await act(async () => {
      render(<Popup />)
    })

    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0]

    await act(async () => {
      listener?.({ type: 'TTS_STATE_CHANGED', payload: { state: 'paused' } }, {}, vi.fn())
    })

    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    expect(screen.getByText(/paused/i)).toBeInTheDocument()
  })

  it('sends TTS_ACTION pause when Pause is clicked during playback', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)

    await act(async () => {
      render(<Popup />)
    })

    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0]
    await act(async () => {
      listener?.({ type: 'TTS_STATE_CHANGED', payload: { state: 'playing' } }, {}, vi.fn())
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    })

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'TTS_ACTION',
      payload: { action: 'pause' },
    })
  })

  it('sends TTS_ACTION stop when Stop is clicked during playback', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)

    await act(async () => {
      render(<Popup />)
    })

    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0]
    await act(async () => {
      listener?.({ type: 'TTS_STATE_CHANGED', payload: { state: 'playing' } }, {}, vi.fn())
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /stop reading/i }))
    })

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'TTS_ACTION',
      payload: { action: 'stop' },
    })
  })

  it('sends TTS_ACTION resume when Resume is clicked while paused', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)

    await act(async () => {
      render(<Popup />)
    })

    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0]
    await act(async () => {
      listener?.({ type: 'TTS_STATE_CHANGED', payload: { state: 'paused' } }, {}, vi.fn())
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    })

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'TTS_ACTION',
      payload: { action: 'resume' },
    })
  })

  it('swallows sendMessage rejection from TTS controls (catch block)', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('no tab'))

    await act(async () => {
      render(<Popup />)
    })

    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0]
    await act(async () => {
      listener?.({ type: 'TTS_STATE_CHANGED', payload: { state: 'playing' } }, {}, vi.fn())
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    })

    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
  })

  // ── Reading Mode toggle ───────────────────────────────────────────────────

  it('shows "Enter Reading Mode" button when reader is disabled', async () => {
    await act(async () => {
      render(<Popup />)
    })
    expect(screen.getByRole('button', { name: /enter reading mode/i })).toBeInTheDocument()
  })

  it('sends TOGGLE_READING_MODE when the toggle button is clicked', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)

    await act(async () => {
      render(<Popup />)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /enter reading mode/i }))
    })

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'TOGGLE_READING_MODE' })
  })

  it('optimistically toggles the button label after click', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)

    await act(async () => {
      render(<Popup />)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /enter reading mode/i }))
    })

    expect(screen.getByRole('button', { name: /exit reading mode/i })).toBeInTheDocument()
  })

  it('swallows sendMessage rejection from reading mode toggle (catch block)', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('no tab'))

    await act(async () => {
      render(<Popup />)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /enter reading mode/i }))
    })

    // No throw — error was swallowed; toggle did not fire since sendMessage rejected
    expect(screen.getByRole('button', { name: /enter reading mode/i })).toBeInTheDocument()
  })

  it('updates reader state when READER_STATE_CHANGED arrives', async () => {
    await act(async () => {
      render(<Popup />)
    })

    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0]

    await act(async () => {
      listener?.({ type: 'READER_STATE_CHANGED', payload: { enabled: true } }, {}, vi.fn())
    })

    expect(screen.getByRole('button', { name: /exit reading mode/i })).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows "Exit Reading Mode" button when reader is enabled via loaded state', async () => {
    vi.mocked(chrome.runtime.sendMessage)
      .mockResolvedValueOnce({ ok: false })   // GET_TTS_STATE
      .mockResolvedValueOnce({ ok: true, data: true }) // GET_READER_STATE

    await act(async () => {
      render(<Popup />)
    })

    expect(screen.getByRole('button', { name: /exit reading mode/i })).toBeInTheDocument()
  })

  // ── Reader Settings panel ─────────────────────────────────────────────────

  it('expands the Reader Settings panel on click', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /reader settings/i }))

    expect(screen.getByRole('combobox', { name: /^font$/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /font size/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /line height/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /theme/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /column width/i })).toBeInTheDocument()
  })

  it('loads saved reader font from storage on mount', async () => {
    mockGetSettings.mockResolvedValue({ ...defaultSettings, readerFont: 'dyslexic' })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /reader settings/i }))

    const fontSelect = screen.getByRole('combobox', { name: /^font$/i }) as HTMLSelectElement
    expect(fontSelect.value).toBe('dyslexic')
  })

  it('saves reader font change immediately', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /reader settings/i }))

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: /^font$/i }), {
        target: { value: 'serif' },
      })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ readerFont: 'serif' })
  })

  it('saves reader font size change immediately', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /reader settings/i }))

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: /font size/i }), {
        target: { value: '22' },
      })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ readerFontSize: 22 })
  })

  it('saves reader line height change immediately', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /reader settings/i }))

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: /line height/i }), {
        target: { value: '2' },
      })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ readerLineHeight: 2 })
  })

  it('saves reader theme change immediately', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /reader settings/i }))

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: /theme/i }), {
        target: { value: 'dark' },
      })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ readerTheme: 'dark' })
  })

  it('saves reader column width change immediately', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /reader settings/i }))

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: /column width/i }), {
        target: { value: 'wide' },
      })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ readerColumnWidth: 'wide' })
  })

  // ── LLM Settings panel ────────────────────────────────────────────────────

  it('expands the LLM settings panel on click', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    expect(screen.getByRole('combobox', { name: /provider/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /reading level/i })).toBeInTheDocument()
  })

  it('shows "Not configured" status chip when provider is none', async () => {
    await act(async () => {
      render(<Popup />)
    })

    expect(screen.getByText('Not configured')).toBeInTheDocument()
  })

  it('shows "Ready ✓" status chip when provider is configured with an API key', async () => {
    mockGetSettings.mockResolvedValue({
      ...defaultSettings,
      llmProvider: 'openai',
      apiKey: 'sk-test',
    })

    await act(async () => {
      render(<Popup />)
    })

    expect(screen.getByText('Ready \u2713')).toBeInTheDocument()
  })

  it('shows "Ready ✓" for Ollama without an API key', async () => {
    mockGetSettings.mockResolvedValue({
      ...defaultSettings,
      llmProvider: 'ollama',
      apiKey: '',
    })

    await act(async () => {
      render(<Popup />)
    })

    expect(screen.getByText('Ready \u2713')).toBeInTheDocument()
  })

  it('saves provider change immediately', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: /provider/i }), {
        target: { value: 'openai' },
      })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ llmProvider: 'openai' })
  })

  it('shows API key field when provider is OpenAI', async () => {
    mockGetSettings.mockResolvedValue({ ...defaultSettings, llmProvider: 'openai' })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument()
  })

  it('shows API key field when provider is Anthropic', async () => {
    mockGetSettings.mockResolvedValue({ ...defaultSettings, llmProvider: 'anthropic' })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument()
  })

  it('saves API key change immediately', async () => {
    mockGetSettings.mockResolvedValue({ ...defaultSettings, llmProvider: 'openai' })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-abc' } })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ apiKey: 'sk-abc' })
  })

  it('shows Ollama URL and model fields when provider is Ollama', async () => {
    mockGetSettings.mockResolvedValue({ ...defaultSettings, llmProvider: 'ollama' })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    expect(screen.getByLabelText(/ollama url/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/model/i)).toBeInTheDocument()
  })

  it('saves Ollama URL change immediately', async () => {
    mockGetSettings.mockResolvedValue({ ...defaultSettings, llmProvider: 'ollama' })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/ollama url/i), {
        target: { value: 'http://localhost:9999' },
      })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ ollamaUrl: 'http://localhost:9999' })
  })

  it('saves Ollama model change immediately', async () => {
    mockGetSettings.mockResolvedValue({ ...defaultSettings, llmProvider: 'ollama' })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'mistral' } })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ ollamaModel: 'mistral' })
  })

  it('saves reading level change immediately', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: /reading level/i }), {
        target: { value: '3' },
      })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ readingLevel: 3 })
  })

  it('does not show Ollama fields when provider is OpenAI', async () => {
    mockGetSettings.mockResolvedValue({ ...defaultSettings, llmProvider: 'openai' })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    expect(screen.queryByLabelText(/ollama url/i)).toBeNull()
    expect(screen.queryByLabelText(/model/i)).toBeNull()
  })

  it('does not show API key field when provider is Ollama', async () => {
    mockGetSettings.mockResolvedValue({ ...defaultSettings, llmProvider: 'ollama' })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    expect(screen.queryByLabelText(/api key/i)).toBeNull()
  })

  it('does not show any optional fields when provider is None', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    expect(screen.queryByLabelText(/api key/i)).toBeNull()
    expect(screen.queryByLabelText(/ollama url/i)).toBeNull()
    expect(screen.queryByLabelText(/model/i)).toBeNull()
  })

  it('loads saved LLM settings from storage on mount', async () => {
    mockGetSettings.mockResolvedValue({
      ...defaultSettings,
      llmProvider: 'anthropic',
      apiKey: 'ant-saved',
      readingLevel: 8,
    })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /llm settings/i }))

    const providerSelect = screen.getByRole('combobox', {
      name: /provider/i,
    }) as HTMLSelectElement
    expect(providerSelect.value).toBe('anthropic')

    const levelSelect = screen.getByRole('combobox', {
      name: /reading level/i,
    }) as HTMLSelectElement
    expect(levelSelect.value).toBe('8')
  })
})
