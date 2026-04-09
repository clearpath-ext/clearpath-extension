<div align="center">
  <img src="https://raw.githubusercontent.com/clearpath-ext/.github/main/profile/logo.svg" width="80" height="80" alt="ClearPath logo" />

  <h1>ClearPath Extension</h1>

  <p><strong>A free, open source browser extension that makes any webpage accessible.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Chrome-Coming_Soon-4F8EF7?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome"/>
    <img src="https://img.shields.io/badge/Firefox-Coming_Soon-FF7139?style=flat-square&logo=firefox&logoColor=white" alt="Firefox"/>
    <img src="https://img.shields.io/github/v/release/clearpath-ext/clearpath-extension?style=flat-square&label=Release" alt="Release"/>
    <img src="https://img.shields.io/github/license/clearpath-ext/clearpath-extension?style=flat-square" alt="License"/>
    <img src="https://img.shields.io/github/actions/workflow/status/clearpath-ext/clearpath-extension/ci.yml?label=CI&style=flat-square" alt="CI"/>
  </p>

</div>

---

## Why ClearPath?

The web was built for people who can read dense text quickly, understand jargon, and process visually complex layouts. That's not everyone.

ClearPath is a browser extension that lets you — or someone you care for — experience any webpage differently. Select text and simplify it. Have a page read aloud with word-by-word highlighting. Switch into a clean reading mode with a dyslexia-friendly font. Overlay AAC symbols above words.

No account. No data collection. No server. It all runs in your browser.

---

## Features

### ✅ Read Aloud *(v0.1.0)*
Reads any selected text or full page content using your browser's built-in text-to-speech. Words are highlighted as they're spoken. Fully configurable: voice, speed, pitch. Works offline.

### ✅ Simplify *(v0.2.0)*
Select any text, right-click, and choose **Simplify**. The text is rewritten in plain English at your chosen reading level (Grade 3, 5, or 8) using an LLM. Works with your own OpenAI or Anthropic API key, or locally with Ollama — your text never touches our servers.

### ✅ Reading Mode *(v0.3.0)*
Strips a page down to its main content using Mozilla Readability. Apply custom typography: font family (including OpenDyslexic), size, and line height. Choose from four color themes (light, dark, sepia, high-contrast). Words are highlighted in sync with Read Aloud when both are active together.

### ✅ Focus Tools *(v0.4.0)*
- **Reading ruler** — a semi-transparent colored band that follows your cursor to help you track lines
- **Paragraph focus** — dims all other content in reading mode, keeping just the paragraph you're on fully visible
- **Word complexity** — underlines hard words with a dotted amber line and shows a simpler alternative on hover, sourced from plainlanguage.gov

### ✅ Symbol Overlay *(v0.5.0)*
Displays AAC pictogram symbols above words on any page, powered by the open [ARASAAC](https://arasaac.org) symbol library (CC BY-NC-SA 4.0). Two density modes: **key words only** (~36 high-frequency core vocabulary words) or **all supported words** (~100 words). Toggle from the popup or right-click context menu. Works on any page, not just reading mode.

### ✅ Profiles *(v0.5.0)*
Create named accessibility profiles and save your current settings with one click. Export profiles as JSON to back them up or share them — ideal for SLPs configuring settings for a client, or caregivers setting up a device for a family member. Import profiles from JSON on any device.

### 🗓 Vocabulary Support *(planned)*
Double-click any word for an instant plain-English definition. No API required — powered by an embedded open dictionary.

---

## Installation

### From the Browser Stores (Recommended)
- Chrome / Edge / Brave: Chrome Web Store *(coming soon)*
- Firefox: Firefox Add-ons *(coming soon)*

### From Source
```bash
git clone https://github.com/clearpath-ext/clearpath-extension.git
cd clearpath-extension
pnpm install
pnpm build        # Production build
pnpm dev          # Development build with hot reload
# Load Unpacked in chrome://extensions → select /dist
```

---

## API Setup (Optional)

Read Aloud works immediately with no setup.

Simplify requires an LLM API key, or a local Ollama instance. Your text goes directly from your browser to your chosen API — it never passes through any ClearPath server.

1. Open the extension popup → click **LLM Settings**
2. Choose your provider: OpenAI, Anthropic, or Ollama (local)
3. Paste your API key (or set your Ollama URL)
4. Choose a reading level: Grade 3, 5, or 8
5. Done — right-click any selected text and choose **Simplify**

---

## Tech Stack

| | |
|---|---|
| Language | TypeScript 5 (strict) |
| Build | Vite 5 + CRXJS 2 |
| UI | React 18 + Tailwind CSS (popup); vanilla DOM + Shadow DOM (content scripts) |
| TTS | Web Speech API |
| LLM | OpenAI / Anthropic / Ollama (direct from browser — no proxy) |
| Testing | Vitest + jsdom + Testing Library (379 tests, 100% coverage) |
| CI/CD | GitHub Actions |
| Standard | Manifest V3 |
| Package Manager | pnpm |

---

## Project Structure

```
src/
├── background/
│   └── service-worker.ts   # Context menus, message routing, LLM calls
├── content/
│   ├── index.ts            # Module coordinator, message listener
│   ├── tts.ts              # Text-to-speech controller
│   ├── toolbar.ts          # Floating playback toolbar (Shadow DOM)
│   ├── overlay.ts          # Simplification result panel (Shadow DOM)
│   ├── reader.ts           # Full-viewport reading mode panel (Shadow DOM)
│   ├── highlighter.ts      # Word-level TTS highlight (binary search over char positions)
│   ├── ruler.ts            # Reading ruler (Shadow DOM band tracking mousemove)
│   ├── focus.ts            # Paragraph focus (dims reader content except hovered block)
│   ├── complexity.ts       # Word complexity (plainlanguage.gov map + hover tooltips)
│   ├── symbolData.ts       # ARASAAC word→image map (key ~36 words / all ~100 words)
│   └── symbols.ts          # Symbol overlay (wraps text nodes with pictogram images)
├── lib/
│   ├── llm.ts              # LLM provider abstraction (OpenAI / Anthropic / Ollama)
│   ├── profiles.ts         # Named profiles: save/load/delete/export/import
│   └── storage.ts          # chrome.storage.sync wrappers
├── popup/
│   ├── Popup.tsx           # React popup: Read Aloud + Voice + LLM + Reader + Focus Tools + Symbols + Profiles
│   └── index.tsx
└── shared/
    └── types.ts            # Message union, Settings interface, defaults
```

---

## Contributing

ClearPath welcomes contributions from everyone — developers, designers, SLPs, AAC specialists, and people with lived experience of disability.

Quick start:
1. Browse [`good first issue`](https://github.com/clearpath-ext/clearpath-extension/labels/good%20first%20issue) for beginner-friendly tasks
2. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines
3. Join the conversation in [Discussions](https://github.com/clearpath-ext/clearpath-extension/discussions)

---

## Changelog

### v0.5.0 — Profiles & Symbol Overlay *(2026-04-08)*
- Symbol Overlay: ARASAAC pictogram images above words on any page; key/all density modes; togglable from popup + context menu
- Profiles: save, load, delete, export (JSON), and import named accessibility profiles; cap of 10 profiles
- 100% test coverage (379 tests across 16 files)

### v0.4.0 — Focus Tools *(2026-04-08)*
- Reading ruler: configurable-color band that follows the cursor across any page
- Paragraph focus: dims all reader content except the hovered block element
- Word complexity: ~130-word plainlanguage.gov map, dotted underline + hover tooltip
- All three tools togglable from popup and right-click context menu; state persisted across page loads
- 100% test coverage (310 tests across 13 files)

### v0.3.0 — Reading Mode *(2026-04-05)*
- Full-viewport reading mode panel powered by Mozilla Readability (Shadow DOM)
- Four color themes: light, dark, sepia, high-contrast
- Typography controls: font family (System, Serif, Sans, OpenDyslexic), size, line height, column width
- OpenDyslexic font bundled — no external requests
- Word-by-word TTS highlight when reading mode + Read Aloud are active together
- Reading mode toggle in popup and via right-click context menu
- 100% test coverage (241 tests across 10 files)

### v0.2.0 — LLM Simplification *(2026-03-16)*
- Right-click selected text → **Simplify** context menu item
- LLM provider abstraction: OpenAI (gpt-4o-mini), Anthropic (claude-haiku), Ollama, or None
- Shadow DOM result overlay with Copy button and reading level display
- LLM Settings panel in popup: provider, API key, Ollama URL/model, reading level (3/5/8)
- 100% test coverage (160 tests across 9 files)

### v0.1.0 — Read Aloud *(2026-03-15)*
- Read selected text or full page via Web Speech API
- Floating Shadow DOM playback toolbar (pause/stop)
- Word-by-word highlight stub (full implementation in Phase 3)
- Voice, speed, and pitch controls in popup
- Context menu: **Read Aloud** on selected text

---

## Privacy

- Zero data collection. No analytics, no telemetry, no tracking of any kind.
- Settings stored locally via `chrome.storage.sync` — synced to your browser account, not our servers.
- LLM calls are direct — text goes from your browser to your API provider. We have no server.
- Fully open source — every line of code is auditable.

Full details in [PRIVACY.md](PRIVACY.md).

---

## License

MIT — free to use, modify, and distribute.

---

<div align="center">
  <sub>Built by the team behind <a href="https://github.com/sproutaac/app">Sprout AAC</a> · Made with care for the accessibility community</sub>
</div>
