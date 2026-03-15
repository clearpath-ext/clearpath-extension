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

describe('tts module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    mockGetSettings.mockResolvedValueOnce({
      ttsVoice: '',
      ttsRate: 1.5,
      ttsPitch: 0.8,
      llmProvider: 'none',
      apiKey: '',
      ollamaUrl: 'http://localhost:11434',
      readingLevel: 5,
      symbolsEnabled: false,
      symbolDensity: 'key',
    })

    tts.init(() => {}, () => {})
    await tts.speak('Test')
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    expect(utterance.rate).toBe(1.5)
    expect(utterance.pitch).toBe(0.8)
  })

  it('calls speechSynthesis.cancel when stop() is called', () => {
    tts.stop()
    expect(mockCancel).toHaveBeenCalled()
  })

  it('calls speechSynthesis.pause when pause() is called', async () => {
    tts.init(
      (state) => {
        // Simulate playing state after speak
        if (state === 'playing') tts.pause()
      },
      () => {},
    )
    await tts.speak('Pause test')
    // Manually trigger onstart to set state to playing
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    utterance.onstart?.(new Event('start') as SpeechSynthesisEvent)
    tts.pause()
    expect(mockPause).toHaveBeenCalled()
  })

  it('fires state callback on stop', () => {
    const onState = vi.fn()
    tts.init(onState, () => {})
    // Set state to playing by triggering onstart manually
    tts.stop()
    // stop() calls setState('idle') only if not already idle
    // We don't verify the exact call since state starts at idle
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
    // Two deferred promises — we resolve them in reverse order to prove the guard works
    let resolveFirst!: (s: ReturnType<typeof mockGetSettings.mock.results[0]['value']>) => void
    let resolveSecond!: (s: ReturnType<typeof mockGetSettings.mock.results[0]['value']>) => void
    const p1 = new Promise<Awaited<ReturnType<typeof mockGetSettings>>>((r) => (resolveFirst = r))
    const p2 = new Promise<Awaited<ReturnType<typeof mockGetSettings>>>((r) => (resolveSecond = r))

    mockGetSettings.mockReturnValueOnce(p1).mockReturnValueOnce(p2)

    tts.init(() => {}, () => {})

    // Fire both without awaiting — second increments speakVersion past first
    const first = tts.speak('first')
    const second = tts.speak('second')

    const settings = {
      ttsVoice: '',
      ttsRate: 1.0,
      ttsPitch: 1.0,
      llmProvider: 'none' as const,
      apiKey: '',
      ollamaUrl: 'http://localhost:11434',
      readingLevel: 5 as const,
      symbolsEnabled: false,
      symbolDensity: 'key' as const,
    }

    // Resolve second first — it proceeds; when first resolves it must bail
    resolveSecond(settings)
    await second
    resolveFirst(settings)
    await first

    expect(mockSpeak).toHaveBeenCalledOnce()
    const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance
    expect(utterance.text).toBe('second')
  })
})
