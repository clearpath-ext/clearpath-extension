// Global test setup
import '@testing-library/jest-dom/vitest'

// Minimal chrome API mock for tests
const chromeMock = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    getURL: vi.fn().mockReturnValue('chrome-extension://test/'),
    lastError: null as { message: string } | null,
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn().mockImplementation((cb?: () => void) => cb?.()),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
}

// @ts-expect-error — assigning mock to global
globalThis.chrome = chromeMock

// jsdom does not implement the Web Speech API — provide minimal stubs
class SpeechSynthesisUtteranceMock {
  text: string
  rate = 1
  pitch = 1
  voice: SpeechSynthesisVoice | null = null
  onstart: ((e: Event) => void) | null = null
  onend: ((e: Event) => void) | null = null
  onerror: ((e: SpeechSynthesisErrorEvent) => void) | null = null
  onboundary: ((e: SpeechSynthesisEvent) => void) | null = null
  onpause: ((e: Event) => void) | null = null
  onresume: ((e: Event) => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

// @ts-expect-error — partial stub
globalThis.SpeechSynthesisUtterance = SpeechSynthesisUtteranceMock
