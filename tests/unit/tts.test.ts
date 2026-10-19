import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted makes the mock available to the hoisted vi.mock factory.
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

// Mock Web Speech API.
const mockSpeak = vi.fn()
const mockCancel = vi.fn()
const mockPause = vi.fn()
const mockResume = vi.fn()
const mockGetVoices = vi.fn().mockReturnValue([])

Object.defineProperty(window, 'speechSynthesis', {
  configurable: true,
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

    mockGetSettings.mockReset()
    mockGetSettings.mockResolvedValue(defaultSettings)
    mockGetVoices.mockReturnValue([])

    // Replace any previous test's callbacks before resetting the state.
    tts.init(() => {}, () => {})
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

  it('does not call speak for empty or whitespace-only text', async () => {
    tts.init(() => {}, () => {})

    await tts.speak('')
    await tts.speak('   \n\t  ')

    expect(mockSpeak).not.toHaveBeenCalled()
  })

  it('applies rate and pitch from settings', async () => {
    mockGetSettings.mockResolvedValueOnce({
      ...defaultSettings,
      ttsRate: 1.5,
      ttsPitch: 0.8,
    })

    tts.init(() => {}, () => {})
    await tts.speak('Test')

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance

    expect(utterance.rate).toBe(1.5)
    expect(utterance.pitch).toBe(0.8)
  })

  it('selects the configured voice by name when found', async () => {
    const mockVoice = {
      name: 'Google US English',
    } as SpeechSynthesisVoice

    mockGetVoices.mockReturnValue([mockVoice])
    mockGetSettings.mockResolvedValueOnce({
      ...defaultSettings,
      ttsVoice: 'Google US English',
    })

    tts.init(() => {}, () => {})
    await tts.speak('Test')

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance

    expect(utterance.voice).toBe(mockVoice)
  })

  it('does not set a voice when the configured name is not found', async () => {
    mockGetVoices.mockReturnValue([
      { name: 'Other Voice' } as SpeechSynthesisVoice,
    ])

    mockGetSettings.mockResolvedValueOnce({
      ...defaultSettings,
      ttsVoice: 'Missing Voice',
    })

    tts.init(() => {}, () => {})
    await tts.speak('Test')

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance

    expect(utterance.voice).toBeNull()
  })

  it('sets state to playing when the utterance starts', async () => {
    const onState = vi.fn()

    tts.init(onState, () => {})
    await tts.speak('Test')

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onstart?.(new Event('start') as SpeechSynthesisEvent)

    expect(tts.getState()).toBe('playing')
    expect(onState).toHaveBeenCalledWith('playing')
  })

  it('sets state to finished when the utterance ends', async () => {
    const onState = vi.fn()

    tts.init(onState, () => {})
    await tts.speak('Test')

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onend?.(new Event('end') as SpeechSynthesisEvent)

    expect(tts.getState()).toBe('finished')
    expect(onState).toHaveBeenCalledWith('finished')
  })

  it('logs non-interrupted errors and resets state to idle', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onState = vi.fn()

    try {
      tts.init(onState, () => {})
      await tts.speak('Test')

      const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
      utterance.onerror?.({
        error: 'network',
      } as SpeechSynthesisErrorEvent)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ClearPath] TTS error:',
        'network',
      )
      expect(tts.getState()).toBe('idle')
      expect(onState).toHaveBeenCalledWith('idle')
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it.each(['interrupted', 'canceled'])(
    'does not log the %s error',
    async (error) => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        tts.init(() => {}, () => {})
        await tts.speak('Test')

        const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
        utterance.onerror?.({
          error,
        } as SpeechSynthesisErrorEvent)

        expect(consoleSpy).not.toHaveBeenCalled()
        expect(tts.getState()).toBe('idle')
      } finally {
        consoleSpy.mockRestore()
      }
    },
  )

  it('forwards word boundary events to the word callback', async () => {
    const onWord = vi.fn()

    tts.init(() => {}, onWord)
    await tts.speak('Hello world')

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onboundary?.({
      name: 'word',
      charIndex: 5,
    } as SpeechSynthesisEvent)

    expect(onWord).toHaveBeenCalledWith(5, 'Hello world')
  })

  it('ignores non-word boundary events', async () => {
    const onWord = vi.fn()

    tts.init(() => {}, onWord)
    await tts.speak('Hello world')

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onboundary?.({
      name: 'sentence',
      charIndex: 0,
    } as SpeechSynthesisEvent)

    expect(onWord).not.toHaveBeenCalled()
  })

  it('calls speechSynthesis.cancel when stop() is called', () => {
    tts.stop()

    expect(mockCancel).toHaveBeenCalled()
  })

  it('sets the state to idle when stopping active playback', async () => {
    const onState = vi.fn()

    tts.init(onState, () => {})
    await tts.speak('Stop test')

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onstart?.(new Event('start') as SpeechSynthesisEvent)

    onState.mockClear()
    tts.stop()

    expect(mockCancel).toHaveBeenCalled()
    expect(tts.getState()).toBe('idle')
    expect(onState).toHaveBeenCalledWith('idle')
  })

  it('calls speechSynthesis.pause when pause() is called during playback', async () => {
    tts.init(() => {}, () => {})
    await tts.speak('Pause test')

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onstart?.(new Event('start') as SpeechSynthesisEvent)

    tts.pause()

    expect(mockPause).toHaveBeenCalledOnce()
  })

  it('does not call pause unless the state is playing', () => {
    tts.init(() => {}, () => {})

    tts.pause()

    expect(mockPause).not.toHaveBeenCalled()
  })

  it('sets state to paused when the utterance pauses', async () => {
    const onState = vi.fn()

    tts.init(onState, () => {})
    await tts.speak('Pause test')

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onpause?.(new Event('pause') as SpeechSynthesisEvent)

    expect(tts.getState()).toBe('paused')
    expect(onState).toHaveBeenCalledWith('paused')
  })

  it('sets state to playing when the utterance resumes', async () => {
    const onState = vi.fn()

    tts.init(onState, () => {})
    await tts.speak('Resume test')

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onresume?.(new Event('resume') as SpeechSynthesisEvent)

    expect(tts.getState()).toBe('playing')
    expect(onState).toHaveBeenCalledWith('playing')
  })

  it('calls speechSynthesis.resume when state is paused', async () => {
    tts.init(() => {}, () => {})
    await tts.speak('Resume test')

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onpause?.(new Event('pause') as SpeechSynthesisEvent)

    tts.resume()

    expect(mockResume).toHaveBeenCalledOnce()
  })

  it('does not resume when state is not paused', () => {
    tts.init(() => {}, () => {})

    tts.resume()

    expect(mockResume).not.toHaveBeenCalled()
  })

  it('ignores callbacks from an older utterance', async () => {
    const onState = vi.fn()

    tts.init(onState, () => {})
    await tts.speak('First utterance')

    const firstUtterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance

    await tts.speak('Second utterance')

    const secondUtterance = mockSpeak.mock.calls[1][0] as SpeechSynthesisUtterance

    onState.mockClear()

    // An old callback must not overwrite the second utterance's state.
    firstUtterance.onend?.(new Event('end') as SpeechSynthesisEvent)

    expect(tts.getState()).toBe('idle')
    expect(onState).not.toHaveBeenCalled()

    secondUtterance.onstart?.(new Event('start') as SpeechSynthesisEvent)
    expect(tts.getState()).toBe('playing')
  })

  it('does not start speech if stop() is called while settings are loading', async () => {
    let resolveSettings!: (settings: typeof defaultSettings) => void

    const pendingSettings = new Promise<typeof defaultSettings>((resolve) => {
      resolveSettings = resolve
    })

    mockGetSettings.mockReturnValueOnce(pendingSettings)

    tts.init(() => {}, () => {})

    const pendingSpeak = tts.speak('Do not speak')
    tts.stop()

    resolveSettings(defaultSettings)
    await pendingSpeak

    expect(mockSpeak).not.toHaveBeenCalled()
  })

  it('only speaks the last call when speak() calls race on getSettings()', async () => {
    let resolveFirst!: (settings: typeof defaultSettings) => void
    let resolveSecond!: (settings: typeof defaultSettings) => void

    const firstSettings = new Promise<typeof defaultSettings>((resolve) => {
      resolveFirst = resolve
    })

    const secondSettings = new Promise<typeof defaultSettings>((resolve) => {
      resolveSecond = resolve
    })

    mockGetSettings
      .mockReturnValueOnce(firstSettings)
      .mockReturnValueOnce(secondSettings)

    tts.init(() => {}, () => {})

    const first = tts.speak('first')
    const second = tts.speak('second')

    resolveSecond(defaultSettings)
    await second

    resolveFirst(defaultSettings)
    await first

    expect(mockSpeak).toHaveBeenCalledOnce()

    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    expect(utterance.text).toBe('second')
  })

  it('returns the available voice list', () => {
    const mockVoices = [
      { name: 'Google US English' },
      { name: 'Google UK English Female' },
    ] as SpeechSynthesisVoice[]

    mockGetVoices.mockReturnValue(mockVoices)

    expect(tts.getVoices()).toEqual(mockVoices)
  })
})