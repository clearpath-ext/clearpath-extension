import * as tts from './tts'
import * as toolbar from './toolbar'
import * as highlighter from './highlighter'
import * as overlay from './overlay'
import * as reader from './reader'
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

console.debug('[ClearPath] Content script: initializing')
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
overlay.init()
reader.init({
  onClose() {
    tts.stop()
    highlighter.detach()
    // Notify popup that reading mode is now off
    chrome.runtime.sendMessage({
      type: 'READER_STATE_CHANGED',
      payload: { enabled: false },
    } satisfies Message).catch(() => {})
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPageText(): string {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      /* v8 ignore next -- text nodes in a live body always have parentElement */
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
        return NodeFilter.FILTER_REJECT
      }
      if (parent.closest('[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT
      const style = window.getComputedStyle(parent)
      if (style.display === 'none' || style.visibility === 'hidden') {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const parts: string[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    const t = node.textContent?.trim()
    if (t) parts.push(t)
  }
  return parts.join(' ')
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    console.debug('[ClearPath] Content: message received —', message.type)
    switch (message.type) {
      case 'TTS_SPEAK_SELECTION': {
        const text = window.getSelection()?.toString().trim() ?? ''
        if (text) {
          tts
            .speak(text)
            .then(() => sendResponse({ ok: true, data: undefined }))
            .catch((e: unknown) => sendResponse({ ok: false, error: String(e) }))
        } else {
          sendResponse({ ok: false, error: 'No text selected' })
        }
        return true
      }

      case 'TTS_SPEAK_PAGE': {
        let text: string
        if (reader.isOpen()) {
          // Use reader's cleaned text and attach highlighter for word tracking
          text = reader.getSpokenText()
          const contentEl = reader.getContentEl()
          if (contentEl) highlighter.attach(contentEl, text)
        } else {
          text = extractPageText()
        }
        tts
          .speak(text)
          .then(() => sendResponse({ ok: true, data: undefined }))
          .catch((e: unknown) => sendResponse({ ok: false, error: String(e) }))
        return true
      }

      case 'TTS_SPEAK': {
        tts
          .speak(message.payload.text)
          .then(() => sendResponse({ ok: true, data: undefined }))
          .catch((e: unknown) => sendResponse({ ok: false, error: String(e) }))
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

      case 'SIMPLIFY_LOADING': {
        overlay.showLoading()
        break
      }

      case 'SIMPLIFY_RESULT': {
        overlay.showResult(message.payload.simplified)
        break
      }

      case 'SIMPLIFY_ERROR': {
        overlay.showError(message.payload.error)
        break
      }

      case 'TOGGLE_READING_MODE': {
        if (reader.isOpen()) {
          reader.close()
        } else {
          void reader.open().then(() => {
            chrome.runtime.sendMessage({
              type: 'READER_STATE_CHANGED',
              payload: { enabled: true },
            } satisfies Message).catch(() => {})
          })
        }
        sendResponse({ ok: true, data: undefined })
        break
      }

      case 'GET_READER_STATE': {
        sendResponse({ ok: true, data: reader.isOpen() })
        break
      }
    }
  },
)
