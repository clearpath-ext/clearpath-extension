import { getSettings } from '../lib/storage'
import type { TTSState } from '../shared/types'

let utterance: SpeechSynthesisUtterance | null = null
let currentState: TTSState = 'idle'
let stateCallback: ((state: TTSState) => void) | null = null
let wordCallback:
  | ((charIndex: number, text: string) => void)
  | null = null

let speakVersion = 0

export function init(
  onState: (state: TTSState) => void,
  onWord: (charIndex: number, text: string) => void,
): void {
  stateCallback = onState
  wordCallback = onWord

  console.debug('[ClearPath] TTS: initialized')
}

export function getState(): TTSState {
  return currentState
}

function setState(state: TTSState): void {
  console.debug('[ClearPath] TTS: state →', state)
  currentState = state
  stateCallback?.(state)
}

export async function speak(text: string): Promise<void> {
  // Cancel previous speech and invalidate any pending speak request.
  stop()

  const trimmed = text.trim()
  if (!trimmed) return

  const version = ++speakVersion
  const settings = await getSettings()

  // A newer speak() call or stop() occurred while settings were loading.
  if (version !== speakVersion) return

  console.debug(
    '[ClearPath] TTS: speaking',
    trimmed.length,
    'chars — rate:',
    settings.ttsRate,
    'pitch:',
    settings.ttsPitch,
    'voice:',
    settings.ttsVoice || '(default)',
  )

  const currentUtterance = new SpeechSynthesisUtterance(trimmed)
  utterance = currentUtterance

  currentUtterance.rate = settings.ttsRate
  currentUtterance.pitch = settings.ttsPitch

  if (settings.ttsVoice) {
    const voices = window.speechSynthesis.getVoices()
    const voice = voices.find((voice) => voice.name === settings.ttsVoice)

    if (voice) {
      currentUtterance.voice = voice
    }
  }

  currentUtterance.onstart = () => {
    if (utterance !== currentUtterance) return
    setState('playing')
  }

  currentUtterance.onend = () => {
    if (utterance !== currentUtterance) return

    utterance = null
    setState('finished')
  }

  currentUtterance.onerror = (event) => {
    if (utterance !== currentUtterance) return

    if (
      event.error !== 'interrupted' &&
      event.error !== 'canceled'
    ) {
      console.error('[ClearPath] TTS error:', event.error)
    }

    utterance = null
    setState('idle')
  }

  currentUtterance.onboundary = (event) => {
    if (utterance !== currentUtterance) return

    if (event.name === 'word') {
      wordCallback?.(event.charIndex, trimmed)
    }
  }

  currentUtterance.onpause = () => {
    if (utterance !== currentUtterance) return
    setState('paused')
  }

  currentUtterance.onresume = () => {
    if (utterance !== currentUtterance) return
    setState('playing')
  }

  window.speechSynthesis.speak(currentUtterance)
}

export function pause(): void {
  if (currentState === 'playing') {
    console.debug('[ClearPath] TTS: pause')
    window.speechSynthesis.pause()
  }
}

export function resume(): void {
  if (currentState === 'paused') {
    console.debug('[ClearPath] TTS: resume')
    window.speechSynthesis.resume()
  }
}

export function stop(): void {
  // Invalidate pending speak() calls before canceling speech.
  speakVersion++

  if (currentState !== 'idle') {
    console.debug('[ClearPath] TTS: stop')
  }

  window.speechSynthesis.cancel()
  utterance = null

  if (currentState !== 'idle') {
    setState('idle')
  }
}

export function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices()
}