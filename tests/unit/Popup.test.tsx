import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const { mockGetSettings, mockSetSettings, mockGetProfiles, mockSaveProfile, mockDeleteProfile, mockLoadProfile, mockExportProfiles, mockImportProfiles } = vi.hoisted(() => {
  const mockGetSettings = vi.fn()
  const mockSetSettings = vi.fn().mockResolvedValue(undefined)
  const mockGetProfiles = vi.fn().mockResolvedValue([])
  const mockSaveProfile = vi.fn()
  const mockDeleteProfile = vi.fn().mockResolvedValue(undefined)
  const mockLoadProfile = vi.fn().mockResolvedValue(undefined)
  const mockExportProfiles = vi.fn()
  const mockImportProfiles = vi.fn().mockResolvedValue([])
  return { mockGetSettings, mockSetSettings, mockGetProfiles, mockSaveProfile, mockDeleteProfile, mockLoadProfile, mockExportProfiles, mockImportProfiles }
})

vi.mock('../../src/lib/storage', () => ({
  getSettings: mockGetSettings,
  setSettings: mockSetSettings,
}))

vi.mock('../../src/lib/profiles', () => ({
  getProfiles: mockGetProfiles,
  saveProfile: mockSaveProfile,
  deleteProfile: mockDeleteProfile,
  loadProfile: mockLoadProfile,
  exportProfiles: mockExportProfiles,
  importProfiles: mockImportProfiles,
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
  rulerEnabled: false,
  rulerColor: '#FFD700',
  focusEnabled: false,
  complexityEnabled: false,
}

describe('Popup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({ ...defaultSettings })
    mockGetProfiles.mockResolvedValue([])
    mockSaveProfile.mockResolvedValue({ id: 'new-id', name: 'Test', settings: {}, createdAt: Date.now() })
    mockImportProfiles.mockResolvedValue([])
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

  // ── Focus Tools panel ─────────────────────────────────────────────────────

  it('applies focus tools state from GET_FOCUS_TOOLS_STATE on mount', async () => {
    vi.mocked(chrome.runtime.sendMessage)
      .mockResolvedValueOnce({ ok: false })   // GET_TTS_STATE
      .mockResolvedValueOnce({ ok: false })   // GET_READER_STATE
      .mockResolvedValueOnce({ ok: true, data: { rulerEnabled: true, focusEnabled: false, complexityEnabled: true } })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /focus tools/i }))

    const rulerBtn = screen.getByRole('button', { name: /reading ruler/i })
    expect(rulerBtn).toHaveAttribute('aria-pressed', 'true')

    const complexityBtn = screen.getByRole('button', { name: /word complexity/i })
    expect(complexityBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('updates focus tools state when FOCUS_TOOLS_STATE_CHANGED arrives', async () => {
    await act(async () => {
      render(<Popup />)
    })

    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0]

    await act(async () => {
      listener?.(
        { type: 'FOCUS_TOOLS_STATE_CHANGED', payload: { rulerEnabled: false, focusEnabled: true, complexityEnabled: false } },
        {},
        vi.fn(),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /focus tools/i }))

    const focusBtn = screen.getByRole('button', { name: /paragraph focus/i })
    expect(focusBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('expands the Focus Tools panel on click', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /focus tools/i }))

    expect(screen.getByRole('button', { name: /reading ruler/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /paragraph focus/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /word complexity/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/ruler color/i)).toBeInTheDocument()
  })

  it('sends TOGGLE_RULER and optimistically toggles when ruler button is clicked', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /focus tools/i }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reading ruler/i }))
    })

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'TOGGLE_RULER' })
    expect(screen.getByRole('button', { name: /reading ruler/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sends TOGGLE_FOCUS when paragraph focus button is clicked', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /focus tools/i }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /paragraph focus/i }))
    })

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'TOGGLE_FOCUS' })
  })

  it('sends TOGGLE_COMPLEXITY when word complexity button is clicked', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /focus tools/i }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /word complexity/i }))
    })

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'TOGGLE_COMPLEXITY' })
  })

  it('saves ruler color to storage when color picker changes', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /focus tools/i }))

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/ruler color/i), { target: { value: '#FF0000' } })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ rulerColor: '#ff0000' })
  })

  it('swallows sendMessage rejection for ruler toggle', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('no tab'))

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /focus tools/i }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reading ruler/i }))
    })

    // Toggle did not fire — button stays Off
    expect(screen.getByRole('button', { name: /reading ruler/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('swallows sendMessage rejection for paragraph focus toggle', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('no tab'))

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /focus tools/i }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /paragraph focus/i }))
    })

    expect(screen.getByRole('button', { name: /paragraph focus/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('swallows sendMessage rejection for word complexity toggle', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('no tab'))

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /focus tools/i }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /word complexity/i }))
    })

    expect(screen.getByRole('button', { name: /word complexity/i })).toHaveAttribute('aria-pressed', 'false')
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

  // ── Symbol Overlay panel ──────────────────────────────────────────────────

  it('expands the Symbol Overlay panel on click', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /symbol overlay/i }))

    // Density selector is only visible when panel is expanded
    expect(screen.getByRole('combobox', { name: /symbol density/i })).toBeInTheDocument()
    // Inner toggle button uses aria-label="Symbols" (distinct from section header)
    expect(screen.getByRole('button', { name: /^symbols$/i })).toBeInTheDocument()
  })

  it('applies symbols state from GET_SYMBOLS_STATE on mount', async () => {
    vi.mocked(chrome.runtime.sendMessage)
      .mockResolvedValueOnce({ ok: false })  // GET_TTS_STATE
      .mockResolvedValueOnce({ ok: false })  // GET_READER_STATE
      .mockResolvedValueOnce({ ok: false })  // GET_FOCUS_TOOLS_STATE
      .mockResolvedValueOnce({ ok: true, data: { symbolsEnabled: true, symbolDensity: 'all' } })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /symbol overlay/i }))

    const toggleBtn = screen.getByRole('button', { name: /^symbols$/i })
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('sends TOGGLE_SYMBOLS and optimistically toggles', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)

    await act(async () => {
      render(<Popup />)
    })

    // Open the panel
    fireEvent.click(screen.getByRole('button', { name: /symbol overlay/i }))

    // Click the inner Symbols toggle
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^symbols$/i }))
    })

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'TOGGLE_SYMBOLS' })
    expect(screen.getByRole('button', { name: /^symbols$/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('swallows sendMessage rejection for symbol overlay toggle', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('no tab'))

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /symbol overlay/i }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^symbols$/i }))
    })

    // Toggle did not fire — button stays Off
    expect(screen.getByRole('button', { name: /^symbols$/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('saves symbol density change to storage', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /symbol overlay/i }))

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: /symbol density/i }), {
        target: { value: 'all' },
      })
    })

    expect(mockSetSettings).toHaveBeenCalledWith({ symbolDensity: 'all' })
  })

  it('updates symbols state when SYMBOLS_STATE_CHANGED arrives', async () => {
    await act(async () => {
      render(<Popup />)
    })

    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0]

    await act(async () => {
      listener?.(
        { type: 'SYMBOLS_STATE_CHANGED', payload: { symbolsEnabled: true, symbolDensity: 'all' } },
        {},
        vi.fn(),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /symbol overlay/i }))

    expect(screen.getByRole('button', { name: /^symbols$/i })).toHaveAttribute('aria-pressed', 'true')
  })

  // ── Profiles panel ────────────────────────────────────────────────────────

  it('expands the Profiles panel on click', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /profiles/i }))

    expect(screen.getByLabelText(/profile name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save profile/i })).toBeInTheDocument()
  })

  it('shows "No saved profiles" when list is empty', async () => {
    mockGetProfiles.mockResolvedValue([])

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /profiles/i }))

    expect(screen.getByText(/no saved profiles/i)).toBeInTheDocument()
  })

  it('renders loaded profiles with Load and Delete buttons', async () => {
    mockGetProfiles.mockResolvedValue([
      { id: 'p1', name: 'My Profile', settings: {}, createdAt: 1000 },
    ])

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /profiles/i }))

    expect(screen.getByText('My Profile')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load my profile/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete my profile/i })).toBeInTheDocument()
  })

  it('saves a new profile when Save is clicked', async () => {
    mockSaveProfile.mockResolvedValue({ id: 'new', name: 'Work', settings: {}, createdAt: 2000 })

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /profiles/i }))

    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Work' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save profile/i }))
    })

    expect(mockSaveProfile).toHaveBeenCalledWith('Work')
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('shows an error when saving with empty name', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /profiles/i }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save profile/i }))
    })

    expect(screen.getByText(/name required/i)).toBeInTheDocument()
    expect(mockSaveProfile).not.toHaveBeenCalled()
  })

  it('deletes a profile when Delete is clicked', async () => {
    mockGetProfiles.mockResolvedValue([
      { id: 'p1', name: 'To Delete', settings: {}, createdAt: 1000 },
    ])

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /profiles/i }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete to delete/i }))
    })

    expect(mockDeleteProfile).toHaveBeenCalledWith('p1')
    expect(screen.queryByText('To Delete')).toBeNull()
  })

  it('loads a profile and refreshes settings state', async () => {
    mockGetProfiles.mockResolvedValue([
      { id: 'p1', name: 'Saved', settings: { ttsRate: 0.7 }, createdAt: 1000 },
    ])
    mockGetSettings
      .mockResolvedValueOnce({ ...defaultSettings })   // initial load
      .mockResolvedValueOnce({ ...defaultSettings, ttsRate: 0.7 }) // after loadProfile

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /profiles/i }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /load saved/i }))
    })

    expect(mockLoadProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', name: 'Saved' }),
    )
  })

  it('calls exportProfiles when Export is clicked', async () => {
    mockGetProfiles.mockResolvedValue([
      { id: 'p1', name: 'Export Me', settings: {}, createdAt: 1000 },
    ])

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /profiles/i }))

    fireEvent.click(screen.getByRole('button', { name: /export profiles/i }))

    expect(mockExportProfiles).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'p1' })]),
    )
  })

  it('sets profileError when saveProfile throws', async () => {
    mockSaveProfile.mockRejectedValueOnce(new Error('Maximum of 10 profiles reached'))

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /profiles/i }))
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Too Many' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save profile/i }))
    })

    expect(screen.getByText(/maximum of 10/i)).toBeInTheDocument()
  })

  it('calls importProfiles when a file is selected via the hidden input', async () => {
    mockImportProfiles.mockResolvedValue([
      { id: 'imp', name: 'Imported', settings: {}, createdAt: 5000 },
    ])

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /profiles/i }))

    const mockText = vi.fn().mockResolvedValue('[{"id":"imp","name":"Imported","settings":{},"createdAt":5000}]')
    const mockFile = { text: mockText } as unknown as File
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [mockFile], configurable: true })
      fireEvent.change(fileInput)
    })

    expect(mockImportProfiles).toHaveBeenCalled()
    expect(screen.getByText('Imported')).toBeInTheDocument()
  })

  it('sets profileError when importProfiles throws', async () => {
    mockImportProfiles.mockRejectedValueOnce(new Error('Invalid JSON'))

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /profiles/i }))

    const mockFile = { text: vi.fn().mockResolvedValue('bad json') } as unknown as File
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [mockFile], configurable: true })
      fireEvent.change(fileInput)
    })

    expect(screen.getByText(/invalid json/i)).toBeInTheDocument()
  })

  it('clicking Import button triggers the hidden file input click', async () => {
    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /profiles/i }))

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {})

    fireEvent.click(screen.getByRole('button', { name: /import profiles/i }))

    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })
})
