import * as tts from './tts'
import * as toolbar from './toolbar'
import * as highlighter from './highlighter'
import type { Message, TTSState } from '../shared/types'

// ── Module init ───────────────────────────────────────────────────────────────

function onStateChange(state: TTSState): void {
  if (state === 'idle') {
    toolbar.hide()
    highlighter.clear()
  } else {
    toolbar.show(state)
    toolbar.updateState(state)
  }
  // Notify popup via background
  chrome.runtime.sendMessage({
    type: 'TTS_STATE_CHANGED',
    payload: { state },
  } satisfies Message).catch(() => {
    // Popup may not be open — ignore
  })
}

function onWordBoundary(charIndex: number, text: string): void {
  highlighter.onWordBoundary(charIndex, text)
}

tts.init(onStateChange, onWordBoundary)
highlighter.init()
toolbar.init({
  onPlayPause() {
    const state = tts.getState()
    if (state === 'playing') tts.pause()
    else if (state === 'paused') tts.resume()
  },
  onStop() {
    tts.stop()
  },
})

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    switch (message.type) {
      case 'TTS_SPEAK_SELECTION': {
        const text = window.getSelection()?.toString().trim() ?? ''
        if (text) {
          tts.speak(text).then(() => sendResponse({ ok: true, data: undefined }))
        } else {
          sendResponse({ ok: false, error: 'No text selected' })
        }
        return true
      }

      case 'TTS_SPEAK_PAGE': {
        // Extract visible text — skip scripts, styles, hidden elements
        const body = document.body.cloneNode(true) as HTMLElement
        body.querySelectorAll('script,style,noscript,[aria-hidden="true"]').forEach((el) =>
          el.remove(),
        )
        const text = body.innerText.trim()
        tts.speak(text).then(() => sendResponse({ ok: true, data: undefined }))
        return true
      }

      case 'TTS_SPEAK': {
        tts.speak(message.payload.text).then(() => sendResponse({ ok: true, data: undefined }))
        return true
      }

      case 'TTS_ACTION': {
        const { action } = message.payload
        if (action === 'pause') tts.pause()
        else if (action === 'resume' || action === 'play') tts.resume()
        else if (action === 'stop') tts.stop()
        sendResponse({ ok: true, data: undefined })
        break
      }

      case 'GET_TTS_STATE': {
        sendResponse({ ok: true, data: tts.getState() })
        break
      }
    }
  },
)
