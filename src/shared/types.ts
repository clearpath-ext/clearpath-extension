// ── TTS ──────────────────────────────────────────────────────────────────────

export type TTSAction = 'play' | 'pause' | 'resume' | 'stop'
export type TTSState = 'idle' | 'playing' | 'paused'

// ── Settings ──────────────────────────────────────────────────────────────────

export type ReadingLevel = 3 | 5 | 8
export type LLMProviderName = 'openai' | 'anthropic' | 'ollama' | 'none'
export type SymbolDensity = 'key' | 'all'

export interface Settings {
  ttsVoice: string
  ttsRate: number // 0.5 – 2.0
  ttsPitch: number // 0.5 – 2.0
  llmProvider: LLMProviderName
  apiKey: string
  ollamaUrl: string
  ollamaModel: string
  readingLevel: ReadingLevel
  symbolsEnabled: boolean
  symbolDensity: SymbolDensity
}

export const DEFAULT_SETTINGS: Settings = {
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
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export interface Profile {
  name: string
  settings: Partial<Settings>
}

// ── Messages ──────────────────────────────────────────────────────────────────

export type Message =
  | { type: 'TTS_SPEAK'; payload: { text: string } }
  | { type: 'TTS_SPEAK_SELECTION' }
  | { type: 'TTS_SPEAK_PAGE' }
  | { type: 'TTS_ACTION'; payload: { action: TTSAction } }
  | { type: 'TTS_STATE_CHANGED'; payload: { state: TTSState } }
  | { type: 'GET_TTS_STATE' }
  | { type: 'SIMPLIFY_TEXT'; payload: { text: string; level: ReadingLevel } }
  | { type: 'SIMPLIFY_LOADING' }
  | { type: 'SIMPLIFY_RESULT'; payload: { simplified: string } }
  | { type: 'SIMPLIFY_ERROR'; payload: { error: string } }
  | { type: 'TOGGLE_READING_MODE'; payload: { enabled: boolean } }
  | { type: 'SUMMARIZE_PAGE' }

export type MessageResponse<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }
