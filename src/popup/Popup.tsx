import { useState, useEffect, useCallback, useRef } from 'react'
import { getSettings, setSettings } from '../lib/storage'
import { getProfiles, saveProfile, deleteProfile, loadProfile, exportProfiles, importProfiles } from '../lib/profiles'
import type {
  Message,
  TTSAction,
  TTSState,
  LLMProviderName,
  ReadingLevel,
  ReaderFont,
  ReaderTheme,
  ReaderColumnWidth,
  SymbolDensity,
  Profile,
  Settings,
} from '../shared/types'

interface FocusToolsState {
  rulerEnabled: boolean
  focusEnabled: boolean
  complexityEnabled: boolean
}

interface SymbolsState {
  symbolsEnabled: boolean
  symbolDensity: SymbolDensity
}

export function Popup() {
  const [ttsState, setTtsState] = useState<TTSState>('idle')
  const [readerEnabled, setReaderEnabled] = useState(false)
  const [voices, setVoices] = useState<string[]>([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [rate, setRate] = useState(1.0)
  const [pitch, setPitch] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showLLM, setShowLLM] = useState(false)
  const [showReader, setShowReader] = useState(false)
  const [showFocusTools, setShowFocusTools] = useState(false)
  const [rulerEnabled, setRulerEnabled] = useState(false)
  const [rulerColor, setRulerColor] = useState('#FFD700')
  const [focusEnabled, setFocusEnabled] = useState(false)
  const [complexityEnabled, setComplexityEnabled] = useState(false)
  const [symbolsEnabled, setSymbolsEnabled] = useState(false)
  const [symbolDensity, setSymbolDensity] = useState<SymbolDensity>('key')
  const [showSymbols, setShowSymbols] = useState(false)
  const [showProfiles, setShowProfiles] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [newProfileName, setNewProfileName] = useState('')
  const [profileError, setProfileError] = useState('')
  const importFileRef = useRef<HTMLInputElement>(null)
  const [llmProvider, setLlmProvider] = useState<LLMProviderName>('none')
  const [apiKey, setApiKey] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.2')
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>(5)
  const [readerFont, setReaderFont] = useState<ReaderFont>('system')
  const [readerFontSize, setReaderFontSize] = useState(18)
  const [readerLineHeight, setReaderLineHeight] = useState(1.75)
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>('light')
  const [readerColumnWidth, setReaderColumnWidth] = useState<ReaderColumnWidth>('medium')
  const rateDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pitchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applySettingsState = useCallback((s: Settings) => {
    setSelectedVoice(s.ttsVoice)
    setRate(s.ttsRate)
    setPitch(s.ttsPitch)
    setLlmProvider(s.llmProvider)
    setApiKey(s.apiKey)
    setOllamaUrl(s.ollamaUrl)
    setOllamaModel(s.ollamaModel)
    setReadingLevel(s.readingLevel)
    setReaderFont(s.readerFont)
    setReaderFontSize(s.readerFontSize)
    setReaderLineHeight(s.readerLineHeight)
    setReaderTheme(s.readerTheme)
    setReaderColumnWidth(s.readerColumnWidth)
    setRulerColor(s.rulerColor)
    setSymbolsEnabled(s.symbolsEnabled)
    setSymbolDensity(s.symbolDensity)
  }, [])

  // Load persisted settings and initial TTS / reader state
  useEffect(() => {
    async function load() {
      const settings = await getSettings()
      applySettingsState(settings)

      const loadedProfiles = await getProfiles()
      setProfiles(loadedProfiles)

      try {
        const ttsRes = await chrome.runtime.sendMessage({
          type: 'GET_TTS_STATE',
        } satisfies Message)
        if (ttsRes?.ok) setTtsState(ttsRes.data as TTSState)
      } catch {
        // Content script not available on this page (e.g. chrome:// URLs)
      }

      try {
        const readerRes = await chrome.runtime.sendMessage({
          type: 'GET_READER_STATE',
        } satisfies Message)
        if (readerRes?.ok) setReaderEnabled(readerRes.data as boolean)
      } catch {
        // Content script not available
      }

      try {
        const focusRes = await chrome.runtime.sendMessage({
          type: 'GET_FOCUS_TOOLS_STATE',
        } satisfies Message)
        if (focusRes?.ok) {
          const data = focusRes.data as FocusToolsState
          setRulerEnabled(data.rulerEnabled)
          setFocusEnabled(data.focusEnabled)
          setComplexityEnabled(data.complexityEnabled)
        }
      } catch {
        // Content script not available
      }

      try {
        const symbolsRes = await chrome.runtime.sendMessage({
          type: 'GET_SYMBOLS_STATE',
        } satisfies Message)
        if (symbolsRes?.ok) {
          const data = symbolsRes.data as SymbolsState
          setSymbolsEnabled(data.symbolsEnabled)
          setSymbolDensity(data.symbolDensity)
        }
      } catch {
        // Content script not available
      }

      setLoading(false)
    }
    load()
  }, [])

  // Populate voice list — must happen in popup context
  useEffect(() => {
    const loadVoices = () => {
      const v = speechSynthesis.getVoices()
      if (v.length > 0) setVoices(v.map((voice) => voice.name))
    }
    loadVoices()
    speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  // Listen for TTS and reader state changes forwarded by the background
  useEffect(() => {
    const listener = (message: Message) => {
      if (message.type === 'TTS_STATE_CHANGED') {
        setTtsState(message.payload.state)
      }
      if (message.type === 'READER_STATE_CHANGED') {
        setReaderEnabled(message.payload.enabled)
      }
      if (message.type === 'FOCUS_TOOLS_STATE_CHANGED') {
        setRulerEnabled(message.payload.rulerEnabled)
        setFocusEnabled(message.payload.focusEnabled)
        setComplexityEnabled(message.payload.complexityEnabled)
      }
      if (message.type === 'SYMBOLS_STATE_CHANGED') {
        setSymbolsEnabled(message.payload.symbolsEnabled)
        setSymbolDensity(message.payload.symbolDensity)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  // Clear pending debounce timers on unmount
  useEffect(() => {
    return () => {
      if (rateDebounce.current) clearTimeout(rateDebounce.current)
      if (pitchDebounce.current) clearTimeout(pitchDebounce.current)
    }
  }, [])

  const sendTtsAction = useCallback(async (action: TTSAction) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'TTS_ACTION',
        payload: { action },
      } satisfies Message)
    } catch {
      // ignore
    }
  }, [])

  const handleReadPage = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'TTS_SPEAK_PAGE' } satisfies Message)
    } catch {
      // ignore
    }
  }, [])

  const handleToggleReaderMode = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'TOGGLE_READING_MODE' } satisfies Message)
      // Optimistic toggle — READER_STATE_CHANGED will confirm
      setReaderEnabled((prev) => !prev)
    } catch {
      // ignore
    }
  }, [])

  const handleToggleRuler = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'TOGGLE_RULER' } satisfies Message)
      setRulerEnabled((prev) => !prev)
    } catch {
      // ignore
    }
  }, [])

  const handleToggleFocus = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'TOGGLE_FOCUS' } satisfies Message)
      setFocusEnabled((prev) => !prev)
    } catch {
      // ignore
    }
  }, [])

  const handleToggleComplexity = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'TOGGLE_COMPLEXITY' } satisfies Message)
      setComplexityEnabled((prev) => !prev)
    } catch {
      // ignore
    }
  }, [])

  const handleToggleSymbols = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'TOGGLE_SYMBOLS' } satisfies Message)
      setSymbolsEnabled((prev) => !prev)
    } catch {
      // ignore
    }
  }, [])

  const handleSymbolDensityChange = async (value: SymbolDensity) => {
    setSymbolDensity(value)
    await setSettings({ symbolDensity: value })
  }

  const handleSaveProfile = async () => {
    if (!newProfileName.trim()) {
      setProfileError('Name required')
      return
    }
    try {
      const saved = await saveProfile(newProfileName)
      setProfiles((prev) => [...prev, saved])
      setNewProfileName('')
      setProfileError('')
    } catch (e) {
      setProfileError(String(e))
    }
  }

  const handleLoadProfile = async (profile: Profile) => {
    await loadProfile(profile)
    const s = await getSettings()
    applySettingsState(s)
  }

  const handleDeleteProfile = async (id: string) => {
    await deleteProfile(id)
    setProfiles((prev) => prev.filter((p) => p.id !== id))
  }

  const handleExportProfiles = () => {
    exportProfiles(profiles)
  }

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    /* v8 ignore next */
    if (!file) return
    try {
      const text = await file.text()
      const merged = await importProfiles(text)
      setProfiles(merged)
      setProfileError('')
    } catch (err) {
      setProfileError(String(err))
    }
    e.target.value = ''
  }

  const handleRulerColorChange = async (value: string) => {
    setRulerColor(value)
    await setSettings({ rulerColor: value })
  }

  const handleVoiceChange = async (name: string) => {
    setSelectedVoice(name)
    await setSettings({ ttsVoice: name })
  }

  const handleRateChange = (value: number) => {
    setRate(value)
    if (rateDebounce.current) clearTimeout(rateDebounce.current)
    rateDebounce.current = setTimeout(() => setSettings({ ttsRate: value }), 300)
  }

  const handlePitchChange = (value: number) => {
    setPitch(value)
    if (pitchDebounce.current) clearTimeout(pitchDebounce.current)
    pitchDebounce.current = setTimeout(() => setSettings({ ttsPitch: value }), 300)
  }

  const handleLlmProviderChange = async (value: LLMProviderName) => {
    setLlmProvider(value)
    await setSettings({ llmProvider: value })
  }

  const handleApiKeyChange = async (value: string) => {
    setApiKey(value)
    await setSettings({ apiKey: value })
  }

  const handleOllamaUrlChange = async (value: string) => {
    setOllamaUrl(value)
    await setSettings({ ollamaUrl: value })
  }

  const handleOllamaModelChange = async (value: string) => {
    setOllamaModel(value)
    await setSettings({ ollamaModel: value })
  }

  const handleReadingLevelChange = async (value: ReadingLevel) => {
    setReadingLevel(value)
    await setSettings({ readingLevel: value })
  }

  const handleReaderFontChange = async (value: ReaderFont) => {
    setReaderFont(value)
    await setSettings({ readerFont: value })
  }

  const handleReaderFontSizeChange = async (value: number) => {
    setReaderFontSize(value)
    await setSettings({ readerFontSize: value })
  }

  const handleReaderLineHeightChange = async (value: number) => {
    setReaderLineHeight(value)
    await setSettings({ readerLineHeight: value })
  }

  const handleReaderThemeChange = async (value: ReaderTheme) => {
    setReaderTheme(value)
    await setSettings({ readerTheme: value })
  }

  const handleReaderColumnWidthChange = async (value: ReaderColumnWidth) => {
    setReaderColumnWidth(value)
    await setSettings({ readerColumnWidth: value })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isActive = ttsState !== 'idle'
  const llmReady = llmProvider !== 'none' && (apiKey !== '' || llmProvider === 'ollama')

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-blue to-brand-green flex items-center justify-center">
          <span className="text-white text-xs font-bold">CP</span>
        </div>
        <span className="font-semibold text-sm text-white tracking-wide">ClearPath</span>
        <span className="ml-auto text-xs text-slate-500 font-medium">v0.5</span>
      </div>

      {/* Read Aloud section */}
      <div className="px-4 py-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Read Aloud
        </p>

        {!isActive ? (
          /* Idle state — Read Page button */
          <button
            onClick={handleReadPage}
            className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all
              bg-gradient-to-r from-brand-blue to-brand-green
              hover:opacity-90 focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900"
          >
            Read Page
          </button>
        ) : (
          /* Active state — playback controls */
          <div className="space-y-2">
            {/* State indicator */}
            <div className="flex items-center gap-2 mb-3">
              <div
                className={`w-2 h-2 rounded-full ${ttsState === 'playing' ? 'bg-brand-green animate-pulse' : 'bg-yellow-400'}`}
              />
              <span className="text-xs text-slate-400">
                {ttsState === 'playing' ? 'Reading page\u2026' : 'Paused'}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  sendTtsAction(ttsState === 'playing' ? 'pause' : 'resume')
                }
                aria-label={ttsState === 'playing' ? 'Pause' : 'Resume'}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium
                  bg-navy-800 hover:bg-navy-700 text-slate-200 border border-white/10
                  transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                {ttsState === 'playing' ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                      <rect x="1" y="0" width="4" height="12" rx="1" />
                      <rect x="7" y="0" width="4" height="12" rx="1" />
                    </svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                      <path d="M2 1L11 6 2 11V1Z" />
                    </svg>
                    Resume
                  </>
                )}
              </button>
              <button
                onClick={() => sendTtsAction('stop')}
                aria-label="Stop reading"
                className="flex items-center justify-center w-9 h-9 rounded-lg
                  bg-navy-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400
                  border border-white/10 transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                  <rect x="1" y="1" width="10" height="10" rx="1.5" />
                </svg>
              </button>
            </div>

            {/* Hint: right-click to read selection */}
            <p className="text-xs text-slate-600 text-center pt-1">
              Tip: right-click selected text to read a selection
            </p>
          </div>
        )}

        {/* Right-click hint (idle state) */}
        {!isActive && (
          <p className="text-xs text-slate-600 text-center mt-2">
            Or right-click selected text \u2192 Read Aloud
          </p>
        )}
      </div>

      {/* Reading Mode toggle */}
      <div className="px-4 pb-4 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Reading Mode
          </p>
          {readerEnabled && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-brand-blue/20 text-brand-blue">
              Active
            </span>
          )}
        </div>
        <button
          onClick={handleToggleReaderMode}
          aria-pressed={readerEnabled}
          className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue
            focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900
            ${readerEnabled
              ? 'bg-brand-blue/20 text-brand-blue border border-brand-blue/40 hover:bg-brand-blue/30'
              : 'bg-navy-800 text-slate-300 border border-white/10 hover:bg-navy-700'
            }`}
        >
          {readerEnabled ? 'Exit Reading Mode' : 'Enter Reading Mode'}
        </button>
      </div>

      {/* Focus Tools */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowFocusTools((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold
            text-slate-400 uppercase tracking-widest hover:text-slate-300 transition-colors
            focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-brand-blue"
          aria-expanded={showFocusTools}
        >
          <span>Focus Tools</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`transition-transform ${showFocusTools ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>

        {showFocusTools && (
          <div className="px-4 pb-4 space-y-3">
            {/* Reading Ruler */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Reading Ruler</span>
              <button
                onClick={handleToggleRuler}
                aria-pressed={rulerEnabled}
                aria-label="Reading Ruler"
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue
                  ${rulerEnabled
                    ? 'bg-brand-blue/20 text-brand-blue border border-brand-blue/40'
                    : 'bg-navy-800 text-slate-400 border border-white/10 hover:bg-navy-700'
                  }`}
              >
                {rulerEnabled ? 'On' : 'Off'}
              </button>
            </div>

            {/* Ruler color */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400" htmlFor="cp-ruler-color">
                Ruler Color
              </label>
              <input
                id="cp-ruler-color"
                type="color"
                value={rulerColor}
                onChange={(e) => handleRulerColorChange(e.target.value)}
                className="w-8 h-7 rounded cursor-pointer border border-white/10 bg-transparent"
                aria-label="Ruler color"
              />
            </div>

            {/* Paragraph Focus */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Paragraph Focus</span>
              <button
                onClick={handleToggleFocus}
                aria-pressed={focusEnabled}
                aria-label="Paragraph Focus"
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue
                  ${focusEnabled
                    ? 'bg-brand-blue/20 text-brand-blue border border-brand-blue/40'
                    : 'bg-navy-800 text-slate-400 border border-white/10 hover:bg-navy-700'
                  }`}
              >
                {focusEnabled ? 'On' : 'Off'}
              </button>
            </div>

            {/* Word Complexity */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Word Complexity</span>
              <button
                onClick={handleToggleComplexity}
                aria-pressed={complexityEnabled}
                aria-label="Word Complexity"
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue
                  ${complexityEnabled
                    ? 'bg-brand-blue/20 text-brand-blue border border-brand-blue/40'
                    : 'bg-navy-800 text-slate-400 border border-white/10 hover:bg-navy-700'
                  }`}
              >
                {complexityEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Symbol Overlay */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowSymbols((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold
            text-slate-400 uppercase tracking-widest hover:text-slate-300 transition-colors
            focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-brand-blue"
          aria-expanded={showSymbols}
        >
          <span>Symbol Overlay</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`transition-transform ${showSymbols ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>

        {showSymbols && (
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Symbols</span>
              <button
                onClick={handleToggleSymbols}
                aria-pressed={symbolsEnabled}
                aria-label="Symbols"
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue
                  ${symbolsEnabled
                    ? 'bg-brand-blue/20 text-brand-blue border border-brand-blue/40'
                    : 'bg-navy-800 text-slate-400 border border-white/10 hover:bg-navy-700'
                  }`}
              >
                {symbolsEnabled ? 'On' : 'Off'}
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1" htmlFor="cp-symbol-density">
                Symbol Density
              </label>
              <select
                id="cp-symbol-density"
                value={symbolDensity}
                onChange={(e) => handleSymbolDensityChange(e.target.value as SymbolDensity)}
                className="w-full bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                  text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value="key">Key words only</option>
                <option value="all">All words</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Profiles */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowProfiles((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold
            text-slate-400 uppercase tracking-widest hover:text-slate-300 transition-colors
            focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-brand-blue"
          aria-expanded={showProfiles}
        >
          <span>Profiles</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`transition-transform ${showProfiles ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>

        {showProfiles && (
          <div className="px-4 pb-4 space-y-3">
            {profiles.length === 0 ? (
              <p className="text-xs text-slate-500">No saved profiles.</p>
            ) : (
              <ul className="space-y-2">
                {profiles.map((profile) => (
                  <li key={profile.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-300 truncate flex-1">{profile.name}</span>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleLoadProfile(profile)}
                        aria-label={`Load ${profile.name}`}
                        className="px-2 py-1 rounded text-xs font-medium bg-brand-blue/20
                          text-brand-blue border border-brand-blue/40 hover:bg-brand-blue/30
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteProfile(profile.id)}
                        aria-label={`Delete ${profile.name}`}
                        className="px-2 py-1 rounded text-xs font-medium bg-navy-800
                          text-slate-400 border border-white/10 hover:bg-red-900/40 hover:text-red-400
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="Profile name"
                aria-label="Profile name"
                className="flex-1 bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                  text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue
                  placeholder:text-slate-600"
              />
              <button
                onClick={handleSaveProfile}
                aria-label="Save profile"
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-brand-blue/20
                  text-brand-blue border border-brand-blue/40 hover:bg-brand-blue/30
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                Save
              </button>
            </div>

            {profileError && (
              <p className="text-xs text-red-400">{profileError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleExportProfiles}
                aria-label="Export profiles"
                className="flex-1 py-1.5 rounded-md text-xs font-semibold bg-navy-800
                  text-slate-400 border border-white/10 hover:bg-navy-700
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                Export
              </button>
              <button
                onClick={() => importFileRef.current?.click()}
                aria-label="Import profiles"
                className="flex-1 py-1.5 rounded-md text-xs font-semibold bg-navy-800
                  text-slate-400 border border-white/10 hover:bg-navy-700
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                Import
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".json"
                className="hidden"
                aria-hidden="true"
                onChange={handleImportFileChange}
              />
            </div>
          </div>
        )}
      </div>

      {/* Voice settings */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold
            text-slate-400 uppercase tracking-widest hover:text-slate-300 transition-colors
            focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-brand-blue"
          aria-expanded={settingsOpen}
        >
          <span>Voice Settings</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`transition-transform ${settingsOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>

        {settingsOpen && (
          <div className="px-4 pb-4 space-y-3">
            {/* Voice selector */}
            <div>
              <label className="block text-xs text-slate-400 mb-1" htmlFor="cp-voice">
                Voice
              </label>
              <select
                id="cp-voice"
                value={selectedVoice}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="w-full bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                  text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value="">Default</option>
                {voices.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Rate slider */}
            <div>
              <label className="flex justify-between text-xs text-slate-400 mb-1" htmlFor="cp-rate">
                <span>Speed</span>
                <span className="text-slate-500">{rate.toFixed(1)}\u00d7</span>
              </label>
              <input
                id="cp-rate"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={rate}
                onChange={(e) => handleRateChange(Number(e.target.value))}
                className="w-full"
                aria-label={`Speech speed: ${rate.toFixed(1)} times`}
              />
              <div className="flex justify-between text-xs text-slate-600 mt-0.5">
                <span>0.5\u00d7</span>
                <span>2\u00d7</span>
              </div>
            </div>

            {/* Pitch slider */}
            <div>
              <label className="flex justify-between text-xs text-slate-400 mb-1" htmlFor="cp-pitch">
                <span>Pitch</span>
                <span className="text-slate-500">{pitch.toFixed(1)}</span>
              </label>
              <input
                id="cp-pitch"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={pitch}
                onChange={(e) => handlePitchChange(Number(e.target.value))}
                className="w-full"
                aria-label={`Speech pitch: ${pitch.toFixed(1)}`}
              />
              <div className="flex justify-between text-xs text-slate-600 mt-0.5">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reader settings */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowReader((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold
            text-slate-400 uppercase tracking-widest hover:text-slate-300 transition-colors
            focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-brand-blue"
          aria-expanded={showReader}
        >
          <span>Reader Settings</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`transition-transform ${showReader ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>

        {showReader && (
          <div className="px-4 pb-4 space-y-3">
            {/* Font family */}
            <div>
              <label className="block text-xs text-slate-400 mb-1" htmlFor="cp-reader-font">
                Font
              </label>
              <select
                id="cp-reader-font"
                value={readerFont}
                onChange={(e) => handleReaderFontChange(e.target.value as ReaderFont)}
                className="w-full bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                  text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value="system">System</option>
                <option value="serif">Serif</option>
                <option value="sans">Sans-serif</option>
                <option value="dyslexic">OpenDyslexic</option>
              </select>
            </div>

            {/* Font size */}
            <div>
              <label className="block text-xs text-slate-400 mb-1" htmlFor="cp-reader-font-size">
                Font Size
              </label>
              <select
                id="cp-reader-font-size"
                value={readerFontSize}
                onChange={(e) => handleReaderFontSizeChange(Number(e.target.value))}
                className="w-full bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                  text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                {[16, 18, 20, 22, 24].map((s) => (
                  <option key={s} value={s}>{s}px</option>
                ))}
              </select>
            </div>

            {/* Line height */}
            <div>
              <label className="block text-xs text-slate-400 mb-1" htmlFor="cp-reader-line-height">
                Line Height
              </label>
              <select
                id="cp-reader-line-height"
                value={readerLineHeight}
                onChange={(e) => handleReaderLineHeightChange(Number(e.target.value))}
                className="w-full bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                  text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value={1.5}>Compact (1.5)</option>
                <option value={1.75}>Normal (1.75)</option>
                <option value={2.0}>Relaxed (2.0)</option>
                <option value={2.5}>Spacious (2.5)</option>
              </select>
            </div>

            {/* Theme */}
            <div>
              <label className="block text-xs text-slate-400 mb-1" htmlFor="cp-reader-theme">
                Theme
              </label>
              <select
                id="cp-reader-theme"
                value={readerTheme}
                onChange={(e) => handleReaderThemeChange(e.target.value as ReaderTheme)}
                className="w-full bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                  text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="sepia">Sepia</option>
                <option value="contrast">High Contrast</option>
              </select>
            </div>

            {/* Column width */}
            <div>
              <label className="block text-xs text-slate-400 mb-1" htmlFor="cp-reader-column-width">
                Column Width
              </label>
              <select
                id="cp-reader-column-width"
                value={readerColumnWidth}
                onChange={(e) => handleReaderColumnWidthChange(e.target.value as ReaderColumnWidth)}
                className="w-full bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                  text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value="narrow">Narrow</option>
                <option value="medium">Medium</option>
                <option value="wide">Wide</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* LLM settings */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowLLM((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold
            text-slate-400 uppercase tracking-widest hover:text-slate-300 transition-colors
            focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-brand-blue"
          aria-expanded={showLLM}
        >
          <span>LLM Settings</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                llmReady
                  ? 'bg-green-900/40 text-green-400'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {llmReady ? 'Ready \u2713' : 'Not configured'}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={`transition-transform ${showLLM ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <path d="M2 4l4 4 4-4" />
            </svg>
          </div>
        </button>

        {showLLM && (
          <div className="px-4 pb-4 space-y-3">
            {/* Provider selector */}
            <div>
              <label className="block text-xs text-slate-400 mb-1" htmlFor="cp-llm-provider">
                Provider
              </label>
              <select
                id="cp-llm-provider"
                value={llmProvider}
                onChange={(e) => handleLlmProviderChange(e.target.value as LLMProviderName)}
                className="w-full bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                  text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value="none">None</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="ollama">Ollama</option>
              </select>
            </div>

            {/* API key — shown for openai / anthropic */}
            {(llmProvider === 'openai' || llmProvider === 'anthropic') && (
              <div>
                <label className="block text-xs text-slate-400 mb-1" htmlFor="cp-api-key">
                  API Key
                </label>
                <input
                  id="cp-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="sk-\u2026"
                  className="w-full bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                    text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>
            )}

            {/* Ollama URL — shown for ollama */}
            {llmProvider === 'ollama' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1" htmlFor="cp-ollama-url">
                  Ollama URL
                </label>
                <input
                  id="cp-ollama-url"
                  type="url"
                  value={ollamaUrl}
                  onChange={(e) => handleOllamaUrlChange(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                    text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>
            )}

            {/* Ollama model — shown for ollama */}
            {llmProvider === 'ollama' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1" htmlFor="cp-ollama-model">
                  Model
                </label>
                <input
                  id="cp-ollama-model"
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => handleOllamaModelChange(e.target.value)}
                  placeholder="llama3.2"
                  className="w-full bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                    text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>
            )}

            {/* Reading level */}
            <div>
              <label className="block text-xs text-slate-400 mb-1" htmlFor="cp-reading-level">
                Reading Level (Simplify)
              </label>
              <select
                id="cp-reading-level"
                value={readingLevel}
                onChange={(e) => handleReadingLevelChange(Number(e.target.value) as ReadingLevel)}
                className="w-full bg-navy-800 border border-white/10 rounded-md px-2 py-1.5
                  text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value={3}>Grade 3</option>
                <option value={5}>Grade 5</option>
                <option value={8}>Grade 8</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
