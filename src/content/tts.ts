import { getSettings } from '../lib/storage'
import type { TTSState } from '../shared/types'

let utterance: SpeechSynthesisUtterance | null = null
let currentState: TTSState = 'idle'
let stateCallback: ((state: TTSState) => void) | null = null
let wordCallback: ((charIndex: number, text: string) => void) | null = null
let speakVersion = 0

export function init(
  onState: (state: TTSState) => void,
  onWord: (charIndex: number, text: string) => void,
): void {
  stateCallback = onState
  wordCallback = onWord
}

export function getState(): TTSState {
  return currentState
}

function setState(state: TTSState): void {
  currentState = state
  stateCallback?.(state)
}

export async function speak(text: string): Promise<void> {
  stop()

  const trimmed = text.trim()
  if (!trimmed) return

  const version = ++speakVersion
  const settings = await getSettings()

  // A newer speak() call arrived while we were awaiting settings — bail out
  if (version !== speakVersion) return

  utterance = new SpeechSynthesisUtterance(trimmed)
  utterance.rate = settings.ttsRate
  utterance.pitch = settings.ttsPitch

  if (settings.ttsVoice) {
    const voices = window.speechSynthesis.getVoices()
    const voice = voices.find((v) => v.name === settings.ttsVoice)
    if (voice) utterance.voice = voice
  }

  utterance.onstart = () => setState('playing')
  utterance.onend = () => {
    utterance = null
    setState('idle')
  }
  utterance.onerror = (e) => {
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
      console.error('[ClearPath TTS] Speech error:', e.error)
    }
    utterance = null
    setState('idle')
  }
  utterance.onboundary = (e) => {
    if (e.name === 'word') {
      wordCallback?.(e.charIndex, trimmed)
    }
  }
  utterance.onpause = () => setState('paused')
  utterance.onresume = () => setState('playing')

  window.speechSynthesis.speak(utterance)
}

export function pause(): void {
  if (currentState === 'playing') {
    window.speechSynthesis.pause()
  }
}

export function resume(): void {
  if (currentState === 'paused') {
    window.speechSynthesis.resume()
  }
}

export function stop(): void {
  window.speechSynthesis.cancel()
  utterance = null
  if (currentState !== 'idle') {
    setState('idle')
  }
}

export function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices()
}
