import { useState, useEffect, useCallback } from 'react'
import { getSettings, setSettings } from '../lib/storage'
import type { Message, TTSAction, TTSState } from '../shared/types'

export function Popup() {
  const [ttsState, setTtsState] = useState<TTSState>('idle')
  const [voices, setVoices] = useState<string[]>([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [rate, setRate] = useState(1.0)
  const [pitch, setPitch] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Load persisted settings and initial TTS state
  useEffect(() => {
    async function load() {
      const settings = await getSettings()
      setSelectedVoice(settings.ttsVoice)
      setRate(settings.ttsRate)
      setPitch(settings.ttsPitch)

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_TTS_STATE',
        } satisfies Message)
        if (response?.ok) setTtsState(response.data as TTSState)
      } catch {
        // Content script not available on this page (e.g. chrome:// URLs)
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

  // Listen for TTS state changes forwarded by the background
  useEffect(() => {
    const listener = (message: Message) => {
      if (message.type === 'TTS_STATE_CHANGED') {
        setTtsState(message.payload.state)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
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

  const handleVoiceChange = async (name: string) => {
    setSelectedVoice(name)
    await setSettings({ ttsVoice: name })
  }

  const handleRateChange = async (value: number) => {
    setRate(value)
    await setSettings({ ttsRate: value })
  }

  const handlePitchChange = async (value: number) => {
    setPitch(value)
    await setSettings({ ttsPitch: value })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isActive = ttsState !== 'idle'

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-blue to-brand-green flex items-center justify-center">
          <span className="text-white text-xs font-bold">CP</span>
        </div>
        <span className="font-semibold text-sm text-white tracking-wide">ClearPath</span>
        <span className="ml-auto text-xs text-slate-500 font-medium">v0.1</span>
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
                {ttsState === 'playing' ? 'Reading page…' : 'Paused'}
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
            Or right-click selected text → Read Aloud
          </p>
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
                <span className="text-slate-500">{rate.toFixed(1)}×</span>
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
                <span>0.5×</span>
                <span>2×</span>
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
    </div>
  )
}
