# ClearPath Architecture

This document explains how the extension is structured and how its parts communicate. Read this before building any new feature — it'll save you hours of confusion.

---

## Chrome Extension Basics

ClearPath is a Manifest V3 Chrome extension. MV3 has three isolated JavaScript contexts that **cannot share memory** and must communicate via message passing:

| Context | File(s) | What It Does |
|---|---|---|
| **Background (Service Worker)** | `src/background/service-worker.ts` | Registers context menus, routes messages, manages LLM API calls |
| **Content Script** | `src/content/index.ts` + others | Injected into every webpage. Renders UI, controls TTS, reads/modifies page DOM |
| **Popup** | `src/popup/index.tsx` | The UI that appears when you click the extension icon |
| **Options Page** | `src/options/index.tsx` | Full settings page (opened from popup or `chrome://extensions`) |

---

## Message Passing Architecture

```
┌─────────────┐     sendMessage      ┌────────────────────┐
│   Popup     │ ──────────────────►  │                    │
│  (React)    │ ◄──────────────────  │    Background      │
└─────────────┘     response         │  Service Worker    │
                                     │                    │
┌─────────────┐   tabs.sendMessage   │                    │
│   Content   │ ◄──────────────────  │                    │
│   Script    │ ──────────────────►  │                    │
│  (in page)  │     sendMessage      └────────────────────┘
└─────────────┘
       │
       ▼
  chrome.storage.sync
  (settings, profiles)
```

### Message Types

All messages are typed in `src/shared/types.ts`. Key message types:

```typescript
// Content script → Background → LLM API → Content script
{ type: 'SIMPLIFY_TEXT', payload: { text: string, level: ReadingLevel } }

// Background → Content script (result)
{ type: 'SIMPLIFY_RESULT', payload: { simplified: string } }

// Popup → Content script
{ type: 'TOGGLE_READING_MODE', payload: { enabled: boolean } }
{ type: 'TOGGLE_TTS', payload: { action: 'play' | 'pause' | 'stop' } }

// Popup → Background → Content script
{ type: 'SUMMARIZE_PAGE' }

// Any → Storage
{ type: 'GET_PROFILE', payload: { name: string } }
{ type: 'SET_PROFILE', payload: Profile }
```

**Rule:** The background service worker is the hub. Content scripts and popups should not communicate directly with each other — always route through the background.

---

## LLM API Abstraction

All LLM calls go through the `LLMProvider` interface in `src/lib/api.ts`. This means you can add a new provider (e.g., Google Gemini) without touching simplification logic.

```typescript
interface LLMProvider {
  simplify(text: string, level: ReadingLevel): Promise<string>;
  summarize(text: string): Promise<string>;
  isAvailable(): boolean;
}
```

Current implementations:
- `OpenAIProvider` — GPT-4o-mini (fast, cheap)
- `AnthropicProvider` — Claude Haiku (fast, cheap)
- `OllamaProvider` — Local model (fully private, no API key)
- `FallbackProvider` — Rule-based simplification (no API needed)

The `FallbackProvider` uses `compromise.js` for NLP-based sentence splitting and a hardcoded list of ~500 common word substitutions. It's not as good as an LLM but it works without any setup.

---

## Content Script Architecture

The content script runs in the context of the webpage. It's split into focused modules:

```
src/content/
├── index.ts         Entry point. Initialises modules and listens for messages.
├── toolbar.tsx      Floating action toolbar (draggable, dismissible)
├── overlay.tsx      Simplification result panel (injected next to selection)
├── reader.tsx       Reading mode — extracts content via Readability, renders clean view
├── tts.ts           Text-to-speech controller wrapping Web Speech API
├── highlighter.ts   Word/sentence highlighting (tracks SpeechSynthesisUtterance events)
├── symbols.ts       AAC symbol overlay (injects <img> above words in DOM)
├── ruler.ts         Reading ruler (follows cursor)
└── vocabulary.ts    Word definition tooltips + complexity highlighting
```

Each module exports an `init()` function and a set of event handlers. `index.ts` coordinates them.

**Important:** Content scripts run inside the webpage's DOM. Be careful not to break page styles. All ClearPath UI is rendered inside a Shadow DOM to prevent CSS leakage in both directions.

---

## Storage Schema

All settings are stored in `chrome.storage.sync`, meaning they sync across the user's Chrome devices.

```typescript
interface StorageSchema {
  settings: {
    llmProvider: 'openai' | 'anthropic' | 'ollama' | 'none';
    apiKey: string;           // Encrypted at rest by Chrome
    ollamaUrl: string;
    readingLevel: 3 | 5 | 8;
    ttsVoice: string;
    ttsRate: number;          // 0.5 – 2.0
    ttsPitch: number;
    symbolsEnabled: boolean;
    symbolDensity: 'key' | 'all';
  };
  profiles: Profile[];        // Array of saved accessibility profiles
  sitePreferences: {          // Per-site settings
    [hostname: string]: Partial<DisplaySettings>;
  };
}
```

The `src/lib/storage.ts` module provides typed wrappers around `chrome.storage.sync` — always use these instead of calling the Chrome API directly.

---

## Symbol Overlay

Symbols come from the [clearpath-symbols](https://github.com/clearpath-ext/clearpath-symbols) repo, which is a separate package bundled at build time.

The symbol lookup works in two steps:
1. `symbols.ts` tokenizes the visible text on the page using `compromise.js`
2. For each token, it looks up the base lemma in `symbol-index.json` (word → symbol filename)
3. If found, it wraps the word in a `<clearpath-symbol>` web component that renders the symbol above the text

The `<clearpath-symbol>` component is defined inside the Shadow DOM to avoid style pollution.

---

## Build System

```bash
pnpm dev          # Dev build, Chrome, hot reload via CRXJS
pnpm dev:firefox  # Dev build, Firefox
pnpm build        # Production build, Chrome
pnpm build:firefox # Production build, Firefox
pnpm typecheck    # Type check only (no emit)
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm test             # Vitest unit tests
pnpm test:e2e     # Playwright E2E tests
pnpm a11y         # Accessibility audit (axe-core)
```

The Vite config outputs to `/dist` (Chrome) and `/dist-firefox` (Firefox). The only meaningful differences between the two builds are in `manifest.json` (Firefox uses `browser_specific_settings`) and the use of `webextension-polyfill` for Firefox's Promise-based API differences.

---

## Adding a New Feature

1. **Design the message flow first.** What context needs to initiate the action? What context does the work? Where does the result go?
2. **Add message types** to `src/shared/types.ts`
3. **Add a handler** in `src/background/service-worker.ts` if the background needs to be involved
4. **Build the content script module** in `src/content/` if it touches the page
5. **Build the UI** in `src/popup/` if it needs a popup control
6. **Write tests** in `tests/unit/` (lib logic) and `tests/e2e/` (user flow)
7. **Update docs** here and in the README if the architecture changes

---

## Further Reading

- [Chrome Extension MV3 Overview](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [CRXJS Vite Plugin docs](https://crxjs.dev/vite-plugin)
- [Web Speech API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Mozilla Readability.js](https://github.com/mozilla/readability)
- [Shadow DOM (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
