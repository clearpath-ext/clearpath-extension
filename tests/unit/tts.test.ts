import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures the mock factory variable is available when vi.mock is hoisted
const { mockGetSettings } = vi.hoisted(() => {
  const mockGetSettings = vi.fn().mockResolvedValue({
    ttsVoice: '',
    ttsRate: 1.0,
    ttsPitch: 1.0,
    llmProvider: 'none',
    apiKey: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
    readingLevel: 5,
    symbolsEnabled: false,
    symbolDensity: 'key',
  })
  return { mockGetSettings }
})

vi.mock('../../src/lib/storage', () => ({
  getSettings: mockGetSettings,
}))

// Mock Web Speech API
const mockSpeak = vi.fn()
const mockCancel = vi.fn()
const mockPause = vi.fn()
const mockResume = vi.fn()
const mockGetVoices = vi.fn().mockReturnValue([])

Object.defineProperty(window, 'speechSynthesis', {
  value: {
    speak: mockSpeak,
    cancel: mockCancel,
    pause: mockPause,
    resume: mockResume,
    getVoices: mockGetVoices,
  },
  writable: true,
})

import * as tts from '../../src/content/tts'

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
}

describe('tts module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue(defaultSettings)
    // Reset state by stopping any active speech
    tts.stop()
  })

  it('starts in idle state', () => {
    expect(tts.getState()).toBe('idle')
  })

  it('calls speechSynthesis.speak when speak() is called with text', async () => {
    tts.init(() => {}, () => {})
    await tts.speak('Hello world')
    expect(mockSpeak).toHaveBeenCalledOnce()
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    expect(utterance.text).toBe('Hello world')
  })

  it('does not call speak for empty string', async () => {
    tts.init(() => {}, () => {})
    await tts.speak('   ')
    expect(mockSpeak).not.toHaveBeenCalled()
  })

  it('applies rate and pitch from settings', async () => {
    mockGetSettings.mockResolvedValueOnce({ ...defaultSettings, ttsRate: 1.5, ttsPitch: 0.8 })

    tts.init(() => {}, () => {})
    await tts.speak('Test')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    expect(utterance.rate).toBe(1.5)
    expect(utterance.pitch).toBe(0.8)
  })

  it('selects the configured voice by name when found', async () => {
    const mockVoice = { name: 'Google US English' } as SpeechSynthesisVoice
    mockGetVoices.mockReturnValue([mockVoice])
    mockGetSettings.mockResolvedValueOnce({ ...defaultSettings, ttsVoice: 'Google US English' })

    tts.init(() => {}, () => {})
    await tts.speak('Test')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    expect(utterance.voice).toBe(mockVoice)
  })

  it('does not set voice when configured name is not in the voices list', async () => {
    mockGetVoices.mockReturnValue([{ name: 'Other Voice' } as SpeechSynthesisVoice])
    mockGetSettings.mockResolvedValueOnce({ ...defaultSettings, ttsVoice: 'Missing Voice' })

    tts.init(() => {}, () => {})
    await tts.speak('Test')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    expect(utterance.voice).toBeNull()
  })

  it('onend callback sets state to idle', async () => {
    const onState = vi.fn()
    tts.init(onState, () => {})
    await tts.speak('Test')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onend?.(new Event('end') as SpeechSynthesisEvent)
    expect(onState).toHaveBeenCalledWith('idle')
  })

  it('onerror callback logs and sets state to idle for non-interrupted errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onState = vi.fn()
    tts.init(onState, () => {})
    await tts.speak('Test')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onerror?.({ error: 'network' } as SpeechSynthesisErrorEvent)
    expect(consoleSpy).toHaveBeenCalled()
    expect(onState).toHaveBeenCalledWith('idle')
    consoleSpy.mockRestore()
  })

  it('onerror callback does not log for interrupted errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    tts.init(() => {}, () => {})
    await tts.speak('Test')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onerror?.({ error: 'interrupted' } as SpeechSynthesisErrorEvent)
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('onerror callback does not log for canceled errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    tts.init(() => {}, () => {})
    await tts.speak('Test')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onerror?.({ error: 'canceled' } as SpeechSynthesisErrorEvent)
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('onboundary callback forwards word events to the word callback', async () => {
    const onWord = vi.fn()
    tts.init(() => {}, onWord)
    await tts.speak('Hello world')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onboundary?.({ name: 'word', charIndex: 5 } as SpeechSynthesisEvent)
    expect(onWord).toHaveBeenCalledWith(5, 'Hello world')
  })

  it('onboundary callback ignores non-word boundary events', async () => {
    const onWord = vi.fn()
    tts.init(() => {}, onWord)
    await tts.speak('Hello world')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onboundary?.({ name: 'sentence', charIndex: 0 } as SpeechSynthesisEvent)
    expect(onWord).not.toHaveBeenCalled()
  })

  it('calls speechSynthesis.cancel when stop() is called', () => {
    tts.stop()
    expect(mockCancel).toHaveBeenCalled()
  })

  it('calls speechSynthesis.pause when pause() is called during playback', async () => {
    tts.init(
      (state) => {
        if (state === 'playing') tts.pause()
      },
      () => {},
    )
    await tts.speak('Pause test')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onstart?.(new Event('start') as SpeechSynthesisEvent)
    tts.pause()
    expect(mockPause).toHaveBeenCalled()
  })

  it('onresume callback sets state to playing', async () => {
    const onState = vi.fn()
    tts.init(onState, () => {})
    await tts.speak('Resume test')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onresume?.(new Event('resume'))
    expect(onState).toHaveBeenCalledWith('playing')
  })

  it('calls speechSynthesis.resume() when resume() is called in the paused state', async () => {
    tts.init(() => {}, () => {})
    await tts.speak('Resume test')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    // Trigger onpause to set internal state to 'paused'
    utterance.onpause?.(new Event('pause'))
    tts.resume()
    expect(mockResume).toHaveBeenCalled()
  })

  it('does not call speechSynthesis.resume() when not in the paused state', () => {
    tts.init(() => {}, () => {})
    // State is 'idle' — resume() guard prevents the call
    tts.resume()
    expect(mockResume).not.toHaveBeenCalled()
  })

  it('fires state callback on stop', () => {
    const onState = vi.fn()
    tts.init(onState, () => {})
    tts.stop()
    expect(mockCancel).toHaveBeenCalled()
  })

  it('returns voice list from speechSynthesis', () => {
    const mockVoices = [
      { name: 'Google US English' },
      { name: 'Google UK English Female' },
    ] as SpeechSynthesisVoice[]
    mockGetVoices.mockReturnValue(mockVoices)
    expect(tts.getVoices()).toHaveLength(2)
  })

  it('only speaks the last call when two speak() calls race on getSettings', async () => {
    let resolveFirst!: (s: typeof defaultSettings) => void
    let resolveSecond!: (s: typeof defaultSettings) => void
    const p1 = new Promise<typeof defaultSettings>((r) => (resolveFirst = r))
    const p2 = new Promise<typeof defaultSettings>((r) => (resolveSecond = r))

    mockGetSettings.mockReturnValueOnce(p1).mockReturnValueOnce(p2)

    tts.init(() => {}, () => {})

    // Fire both without awaiting — second increments speakVersion past first
    const first = tts.speak('first')
    const second = tts.speak('second')

    // Resolve second first — it proceeds; when first resolves it must bail
    resolveSecond(defaultSettings)
    await second
    resolveFirst(defaultSettings)
    await first

    expect(mockSpeak).toHaveBeenCalledOnce()
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    expect(utterance.text).toBe('second')
  })
})
