// ── TTS ──────────────────────────────────────────────────────────────────────

export type TTSAction = 'play' | 'pause' | 'resume' | 'stop'
export type TTSState = 'idle' | 'playing' | 'paused'

// ── Settings ──────────────────────────────────────────────────────────────────

export type ReadingLevel = 3 | 5 | 8
export type LLMProviderName = 'openai' | 'anthropic' | 'ollama' | 'none'
export type SymbolDensity = 'key' | 'all'

export type ReaderFont = 'system' | 'serif' | 'sans' | 'dyslexic'
export type ReaderTheme = 'light' | 'dark' | 'sepia' | 'contrast'
export type ReaderColumnWidth = 'narrow' | 'medium' | 'wide'

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
  // Reading Mode
  readerFont: ReaderFont
  readerFontSize: number // 16 | 18 | 20 | 22 | 24
  readerLineHeight: number // 1.5 | 1.75 | 2.0 | 2.5
  readerTheme: ReaderTheme
  readerColumnWidth: ReaderColumnWidth
  // Focus Tools
  rulerEnabled: boolean
  rulerColor: string // hex color
  focusEnabled: boolean
  complexityEnabled: boolean
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
  // Reading Mode
  readerFont: 'system',
  readerFontSize: 18,
  readerLineHeight: 1.75,
  readerTheme: 'light',
  readerColumnWidth: 'medium',
  // Focus Tools
  rulerEnabled: false,
  rulerColor: '#FFD700',
  focusEnabled: false,
  complexityEnabled: false,
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  name: string
  settings: Partial<Settings>
  createdAt: number
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
  | { type: 'TOGGLE_READING_MODE' }
  | { type: 'GET_READER_STATE' }
  | { type: 'READER_STATE_CHANGED'; payload: { enabled: boolean } }
  | { type: 'SUMMARIZE_PAGE' }
  | { type: 'TOGGLE_RULER' }
  | { type: 'TOGGLE_FOCUS' }
  | { type: 'TOGGLE_COMPLEXITY' }
  | { type: 'GET_FOCUS_TOOLS_STATE' }
  | { type: 'FOCUS_TOOLS_STATE_CHANGED'; payload: { rulerEnabled: boolean; focusEnabled: boolean; complexityEnabled: boolean } }
  | { type: 'TOGGLE_SYMBOLS' }
  | { type: 'GET_SYMBOLS_STATE' }
  | { type: 'SYMBOLS_STATE_CHANGED'; payload: { symbolsEnabled: boolean; symbolDensity: SymbolDensity } }

export type MessageResponse<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }
