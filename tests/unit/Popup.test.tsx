import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

const { mockGetSettings, mockSetSettings } = vi.hoisted(() => {
  const mockGetSettings = vi.fn().mockResolvedValue({
    ttsVoice: '',
    ttsRate: 1.0,
    ttsPitch: 1.0,
    llmProvider: 'none',
    apiKey: '',
    ollamaUrl: 'http://localhost:11434',
    readingLevel: 5,
    symbolsEnabled: false,
    symbolDensity: 'key',
  })
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

describe('Popup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({
      ttsVoice: '',
      ttsRate: 1.0,
      ttsPitch: 1.0,
      llmProvider: 'none',
      apiKey: '',
      ollamaUrl: 'http://localhost:11434',
      readingLevel: 5,
      symbolsEnabled: false,
      symbolDensity: 'key',
    })
    mockGetVoices.mockReturnValue([])
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ ok: false, error: 'no content' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the loading spinner initially', () => {
    // Keep settings loading indefinitely so the component stays in loading state
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

  it('populates the voice dropdown from speechSynthesis', async () => {
    mockGetVoices.mockReturnValue([
      { name: 'Google US English' },
      { name: 'Google UK English' },
    ] as SpeechSynthesisVoice[])

    await act(async () => {
      render(<Popup />)
    })

    // Open voice settings panel
    fireEvent.click(screen.getByRole('button', { name: /voice settings/i }))

    expect(screen.getByRole('option', { name: 'Google US English' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Google UK English' })).toBeInTheDocument()
  })

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

  it('updates UI to active state when TTS_STATE_CHANGED arrives', async () => {
    await act(async () => {
      render(<Popup />)
    })

    // Retrieve the message listener registered on chrome.runtime.onMessage
    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0]

    await act(async () => {
      listener?.({ type: 'TTS_STATE_CHANGED', payload: { state: 'playing' } }, {}, vi.fn())
    })

    expect(screen.getByText(/reading page/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
  })

  it('debounces rate slider — setSettings called once after 300ms', async () => {
    vi.useFakeTimers()

    await act(async () => {
      render(<Popup />)
    })

    fireEvent.click(screen.getByRole('button', { name: /voice settings/i }))
    const rateSlider = screen.getByRole('slider', { name: /speech speed/i })

    // Change rate slider multiple times rapidly
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
})
