import type { Message } from '../shared/types'

const MENU_READ_ALOUD = 'clearpath-read-aloud'

// ── Install ───────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  // Remove first to avoid duplicate-ID errors on extension update
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_READ_ALOUD,
      title: 'Read Aloud',
      contexts: ['selection'],
    })
  })
})

// ── Context menu ──────────────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_READ_ALOUD && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: 'TTS_SPEAK_SELECTION' } satisfies Message)
  }
})

// ── Message routing ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
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

    // Content script → popup: TTS state changed
    if (message.type === 'TTS_STATE_CHANGED') {
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
