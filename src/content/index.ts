import * as tts from './tts'
import * as toolbar from './toolbar'
import * as highlighter from './highlighter'
import * as overlay from './overlay'
import * as reader from './reader'
import * as ruler from './ruler'
import * as focus from './focus'
import * as complexity from './complexity'
import { getSettings, setSettings } from '../lib/storage'
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
    focus.detach()
    complexity.detach()
    // Notify popup that reading mode is now off
    chrome.runtime.sendMessage({
      type: 'READER_STATE_CHANGED',
      payload: { enabled: false },
    } satisfies Message).catch(() => {})
  },
})
ruler.init()
focus.init()
complexity.init()

// Restore persisted focus tool states
void getSettings().then((s) => {
  console.debug('[ClearPath] Content script: restoring focus tools — ruler:', s.rulerEnabled, 'focus:', s.focusEnabled, 'complexity:', s.complexityEnabled)
  ruler.setColor(s.rulerColor)
  /* v8 ignore next -- true branch not reachable at module-import time in tests */
  if (s.rulerEnabled) ruler.setEnabled(true)
  focus.setEnabled(s.focusEnabled)
  complexity.setEnabled(s.complexityEnabled)
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

function notifyFocusToolsChanged(): void {
  chrome.runtime.sendMessage({
    type: 'FOCUS_TOOLS_STATE_CHANGED',
    payload: {
      rulerEnabled: ruler.isEnabled(),
      focusEnabled: focus.isEnabled(),
      complexityEnabled: complexity.isEnabled(),
    },
  } satisfies Message).catch(() => {})
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
            const contentEl = reader.getContentEl()
            if (contentEl) {
              if (focus.isEnabled()) focus.attach(contentEl)
              if (complexity.isEnabled()) complexity.attach(contentEl)
            }
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

      case 'TOGGLE_RULER': {
        const newRuler = !ruler.isEnabled()
        ruler.setEnabled(newRuler)
        void setSettings({ rulerEnabled: newRuler }).then(() => {
          notifyFocusToolsChanged()
          sendResponse({ ok: true, data: { rulerEnabled: newRuler, focusEnabled: focus.isEnabled(), complexityEnabled: complexity.isEnabled() } })
        })
        return true
      }

      case 'TOGGLE_FOCUS': {
        const newFocus = !focus.isEnabled()
        focus.setEnabled(newFocus)
        if (newFocus && reader.isOpen()) {
          const contentEl = reader.getContentEl()
          if (contentEl) focus.attach(contentEl)
        } else if (!newFocus) {
          focus.detach()
        }
        void setSettings({ focusEnabled: newFocus }).then(() => {
          notifyFocusToolsChanged()
          sendResponse({ ok: true, data: { rulerEnabled: ruler.isEnabled(), focusEnabled: newFocus, complexityEnabled: complexity.isEnabled() } })
        })
        return true
      }

      case 'TOGGLE_COMPLEXITY': {
        const newComplexity = !complexity.isEnabled()
        complexity.setEnabled(newComplexity)
        if (newComplexity && reader.isOpen()) {
          const contentEl = reader.getContentEl()
          if (contentEl) complexity.attach(contentEl)
        } else if (!newComplexity) {
          complexity.detach()
        }
        void setSettings({ complexityEnabled: newComplexity }).then(() => {
          notifyFocusToolsChanged()
          sendResponse({ ok: true, data: { rulerEnabled: ruler.isEnabled(), focusEnabled: focus.isEnabled(), complexityEnabled: newComplexity } })
        })
        return true
      }

      case 'GET_FOCUS_TOOLS_STATE': {
        sendResponse({
          ok: true,
          data: {
            rulerEnabled: ruler.isEnabled(),
            focusEnabled: focus.isEnabled(),
            complexityEnabled: complexity.isEnabled(),
          },
        })
        break
      }
    }
  },
)
