import type { Message } from '../shared/types'
import { getSettings } from '../lib/storage'
import { createProvider } from '../lib/llm'

const MENU_READ_ALOUD = 'clearpath-read-aloud'
const MENU_SIMPLIFY = 'clearpath-simplify'
const MENU_READING_MODE = 'clearpath-reading-mode'

// ── Install ───────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.debug('[ClearPath] Service worker: onInstalled — registering context menus')
  // Remove first to avoid duplicate-ID errors on extension update
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_READ_ALOUD,
      title: 'Read Aloud',
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: MENU_SIMPLIFY,
      title: 'Simplify',
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: MENU_READING_MODE,
      title: 'Toggle Reading Mode',
      contexts: ['page', 'selection'],
    })
  })
})

// ── Context menu ──────────────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.debug('[ClearPath] Context menu clicked:', info.menuItemId, 'tab:', tab?.id)

  if (info.menuItemId === MENU_READ_ALOUD && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: 'TTS_SPEAK_SELECTION' } satisfies Message)
  }

  if (info.menuItemId === MENU_READING_MODE && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_READING_MODE' } satisfies Message)
  }

  if (info.menuItemId === MENU_SIMPLIFY && tab?.id != null) {
    const tabId = tab.id
    const text = info.selectionText?.trim()
    if (!text) return

    chrome.tabs.sendMessage(tabId, { type: 'SIMPLIFY_LOADING' } satisfies Message)

    void (async () => {
      try {
        const settings = await getSettings()
        const simplified = await createProvider(settings).simplify(text, settings.readingLevel)
        chrome.tabs.sendMessage(tabId, {
          type: 'SIMPLIFY_RESULT',
          payload: { simplified },
        } satisfies Message)
      } catch (e) {
        chrome.tabs.sendMessage(tabId, {
          type: 'SIMPLIFY_ERROR',
          payload: { error: String(e) },
        } satisfies Message)
      }
    })()
  }
})

// ── Message routing ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    console.debug('[ClearPath] Service worker: message received —', message.type)

    // Popup → content script: TTS control
    if (
      message.type === 'TTS_ACTION' ||
      message.type === 'TTS_SPEAK_PAGE' ||
      message.type === 'TTS_SPEAK'
    ) {
      forwardToActiveTab(message, sendResponse)
      return true
    }

    // Popup → content script: get current TTS state
    if (message.type === 'GET_TTS_STATE') {
      forwardToActiveTab(message, sendResponse)
      return true
    }

    // Popup → content script: toggle / query reading mode
    if (message.type === 'TOGGLE_READING_MODE' || message.type === 'GET_READER_STATE') {
      forwardToActiveTab(message, sendResponse)
      return true
    }

    // Content script → popup: TTS state changed
    if (message.type === 'TTS_STATE_CHANGED') {
      chrome.runtime.sendMessage(message).catch(() => {
        // Popup may not be open — ignore
      })
    }

    // Content script → popup: reader state changed
    if (message.type === 'READER_STATE_CHANGED') {
      chrome.runtime.sendMessage(message).catch(() => {
        // Popup may not be open — ignore
      })
    }
  },
)

async function forwardToActiveTab(
  message: Message,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id == null) {
    sendResponse({ ok: false, error: 'No active tab' })
    return
  }
  chrome.tabs.sendMessage(tab.id, message, (response) => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message })
    } else {
      sendResponse(response)
    }
  })
}
