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
| **Options Page** *(planned)* | `src/options/index.tsx` | Full settings page — Phase 5 |

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
  (settings)
```

**Rule:** The background service worker is the hub. Content scripts and popups do not communicate directly — always route through the background.

### Message Types

All messages are typed in `src/shared/types.ts`. Shipped message types:

```typescript
// TTS — read aloud
{ type: 'TTS_SPEAK'; payload: { text: string } }         // speak specific text
{ type: 'TTS_SPEAK_SELECTION' }                           // speak selected text on page
{ type: 'TTS_SPEAK_PAGE' }                                // speak full page
{ type: 'TTS_ACTION'; payload: { action: TTSAction } }   // pause / resume / stop
{ type: 'GET_TTS_STATE' }                                 // query current state
{ type: 'TTS_STATE_CHANGED'; payload: { state: TTSState } } // state notification

// Simplify — LLM text rewriting (triggered via context menu in service worker)
{ type: 'SIMPLIFY_LOADING' }                              // background → content: show spinner
{ type: 'SIMPLIFY_RESULT'; payload: { simplified: string } } // background → content: show result
{ type: 'SIMPLIFY_ERROR'; payload: { error: string } }    // background → content: show error
```

Planned message types (defined in `types.ts`, not yet wired up):

```typescript
{ type: 'SIMPLIFY_TEXT'; payload: { text: string; level: ReadingLevel } }
{ type: 'TOGGLE_READING_MODE'; payload: { enabled: boolean } }
{ type: 'SUMMARIZE_PAGE' }
```

---

## LLM API Abstraction

All LLM calls go through the `LLMProvider` interface in `src/lib/llm.ts`. Adding a new provider (e.g., Google Gemini) means implementing this interface without touching any other code.

```typescript
interface LLMProvider {
  simplify(text: string, level: ReadingLevel): Promise<string>;
  summarize(text: string): Promise<string>;
}
```

Shipped implementations:
- `OpenAIProvider` — `gpt-4o-mini`, `Authorization: Bearer <key>`
- `AnthropicProvider` — `claude-haiku-4-5-20251001`, `x-api-key` header
- `OllamaProvider` — `POST ${ollamaUrl}/api/chat`, configurable model, stream: false
- `NoProvider` — throws `"No LLM provider configured"` (default when no key is set)

The `createProvider(settings)` factory selects the right implementation based on `settings.llmProvider`.

LLM calls are made in the **service worker**, not the content script — this keeps them isolated from the page's CSP and keeps all LLM logic in one testable place.

---

## Content Script Architecture

The content script runs in the context of the webpage. It's split into focused modules:

```
src/content/
├── index.ts         Entry point. Initialises modules and listens for messages.
├── tts.ts           Text-to-speech controller (Web Speech API)
├── toolbar.ts       Floating playback toolbar (Shadow DOM, bottom-right)
├── overlay.ts       Simplification result panel (Shadow DOM, bottom-right above toolbar)
└── highlighter.ts   Word highlight stub — full implementation in Phase 3
```

Planned additions (Phase 3+):
```
├── reader.ts        Reading mode — extracts content via Readability, renders clean view
├── symbols.ts       AAC symbol overlay
├── ruler.ts         Reading ruler
└── vocabulary.ts    Word definition tooltips
```

Each module exports an `init()` function. `index.ts` coordinates them.

**Important:** All ClearPath UI is rendered inside a **Shadow DOM** to prevent CSS leakage in both directions. Never inject styles directly into the page.

---

## Storage Schema

All settings are stored in `chrome.storage.sync` (syncs across the user's browser devices). Always use the typed wrappers in `src/lib/storage.ts` — never call the Chrome API directly.

```typescript
// src/shared/types.ts
interface Settings {
  ttsVoice: string;         // '' = browser default
  ttsRate: number;          // 0.5 – 2.0
  ttsPitch: number;         // 0.5 – 2.0
  llmProvider: 'openai' | 'anthropic' | 'ollama' | 'none';
  apiKey: string;           // encrypted at rest by Chrome
  ollamaUrl: string;        // default: 'http://localhost:11434'
  ollamaModel: string;      // default: 'llama3.2'
  readingLevel: 3 | 5 | 8; // Grade level for Simplify
  symbolsEnabled: boolean;
  symbolDensity: 'key' | 'all';
}
```

Planned additions (Phase 5):
```typescript
  profiles: Profile[];                           // named accessibility profiles
  sitePreferences: Record<string, Partial<Settings>>; // per-site overrides
```

---

## Build System

```bash
pnpm dev               # Dev build, Chrome, hot reload via CRXJS
pnpm dev:firefox       # Dev build, Firefox
pnpm build             # Production build, Chrome → /dist
pnpm build:firefox     # Production build, Firefox → /dist-firefox
pnpm typecheck         # Type check only (no emit)
pnpm lint              # ESLint
pnpm format            # Prettier
pnpm test              # Vitest unit tests (160 tests, 100% coverage)
pnpm test:watch        # Vitest watch mode
pnpm test:coverage     # Coverage report
```

The Vite config outputs to `/dist` (Chrome). The only meaningful differences between Chrome and Firefox builds are in `manifest.json` (`browser_specific_settings` for Firefox).

---

## Adding a New Feature

1. **Design the message flow first.** What context initiates the action? What context does the work? Where does the result go?
2. **Add message types** to `src/shared/types.ts`
3. **Add a handler** in `src/background/service-worker.ts` if the background needs to be involved
4. **Build the content script module** in `src/content/` if it touches the page — use Shadow DOM for any injected UI
5. **Build the UI** in `src/popup/` if it needs a popup control
6. **Write tests** in `tests/unit/` — aim for 100% coverage on all `src/` files
7. **Update this doc** and the README if the architecture changes

---

## Further Reading

- [Chrome Extension MV3 Overview](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [CRXJS Vite Plugin docs](https://crxjs.dev/vite-plugin)
- [Web Speech API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Shadow DOM (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- [Mozilla Readability.js](https://github.com/mozilla/readability) *(Phase 3)*
