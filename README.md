<div align="center">
  <img src="https://raw.githubusercontent.com/clearpath-ext/.github/main/brand/clearpath-icon.svg" width="80" height="80" alt="ClearPath logo" />

  <h1>ClearPath Extension</h1>

  <p><strong>A free, open source browser extension that makes any webpage accessible.</strong></p>

  <p>
    <!-- Badges are committed (docs/badges) so they don't depend on shields.io loading. release.svg is regenerated on each version bump; a test checks it matches manifest.json -->
    <img src="docs/badges/chrome-web-store-v1.svg" alt="Chrome Web Store: planned for v1.0"/>
    <img src="docs/badges/firefox-after-v1.svg" alt="Firefox: after v1.0"/>
    <a href="https://github.com/clearpath-ext/clearpath-extension/releases/latest"><img src="docs/badges/release.svg" alt="Latest release"/></a>
    <a href="LICENSE"><img src="docs/badges/license-mit.svg" alt="License: MIT"/></a>
    <a href="https://github.com/clearpath-ext/clearpath-extension/actions/workflows/ci.yml"><img src="https://github.com/clearpath-ext/clearpath-extension/actions/workflows/ci.yml/badge.svg" alt="CI status"/></a>
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

### ✅ Vocabulary Support *(v0.6.0)*
Double-click any word for an instant plain-English definition in a Shadow DOM tooltip. No API required, fully offline — powered by a bundled dictionary of 21,881 entries derived from [Simple English Wiktionary](https://simple.wiktionary.org) (CC BY-SA), which is written in plain English by design. A one-time Node.js data pipeline (`scripts/build-dictionary.js`) downloads the Wiktionary XML dump and extracts definitions into a compact 562 KB gzip dictionary bundled with the extension. Toggle from the popup or right-click context menu. Dismiss with Escape or a click outside.

### ✅ Polish *(v0.7.0)*
An accessibility pass across the popup and Reading Mode: keyboard support, focus management, screen reader announcements, and WCAG AA contrast.

### 🗓 Onboarding *(v0.8.0)*
A first-run welcome screen that introduces the tools and walks through the optional LLM API key.

### 🗓 Polish + security audit *(v0.9.0)*
More refinement, and a full security review of the extension before it goes to the store.

### 🗓 Launch *(v1.0.0)*
The Chrome Web Store listing. Firefox support and the Firefox Add-ons listing follow after v1.0.

---

## Installation

### From the Browser Stores
- Chrome / Edge / Brave: Chrome Web Store *(planned for v1.0)*
- Firefox: Firefox Add-ons *(after v1.0)*

### Download a Release (Chrome, Edge, Brave, Arc, Opera)
1. Download [`clearpath-chrome.zip`](https://github.com/clearpath-ext/clearpath-extension/releases/latest/download/clearpath-chrome.zip) from the latest release and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the unzipped folder.

To update later, download the new zip, replace the folder's contents, and click the reload icon on ClearPath's card in `chrome://extensions`.

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
| Testing | Vitest + jsdom + Testing Library + jest-axe (458 tests; 93% statement, 99.7% branch coverage) |
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
│   ├── symbols.ts          # Symbol overlay (wraps text nodes with pictogram images)
│   └── vocab.ts            # Vocabulary support (lazy dictionary load, Shadow DOM tooltip)
├── lib/
│   ├── llm.ts              # LLM provider abstraction (OpenAI / Anthropic / Ollama)
│   ├── profiles.ts         # Named profiles: save/load/delete/export/import
│   └── storage.ts          # settings wrappers (sync; API key in local)
├── popup/
│   ├── Popup.tsx           # React popup: Read Aloud + Voice + LLM + Reader + Focus Tools + Symbols + Vocab + Profiles
│   └── index.tsx
├── shared/
│   ├── logo.ts             # The C-path mark, built as inline SVG for the popup and reader
│   └── types.ts            # Message union, Settings interface, defaults
└── globals.d.ts            # __APP_VERSION__ (injected from manifest.json by Vite)
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

### v0.7.0 — Polish *(2026-10-29)*

**Fixes**
- Symbol Overlay shows pictures again. The ARASAAC images weren't included in the v0.6.0 package, so the overlay had nothing to show.
- The reading ruler stays on top of Reading Mode instead of hiding behind it.
- The popup shows real ×, … and → characters instead of escape codes like `\u00d7`.
- Word definitions show in a properly sized box instead of a narrow column two or three words wide.

**Accessibility**
- Escape closes Reading Mode and the Simplify panel.
- Opening Reading Mode moves keyboard focus into it, and the page behind it can't be reached until it closes.
- Simplify results are announced to screen readers.
- The word-complexity tooltip opens from the keyboard, not only on hover.
- Popup text and all four Reading Mode themes meet WCAG AA contrast.
- The popup respects your system's reduce-motion setting.

**Privacy and security**
- Your LLM API key is stored only on this device and is never included in exported profiles. A key saved by an earlier version moves over automatically.
- Reading Mode cleans each article's HTML with DOMPurify before showing it.
- ClearPath asks for fewer permissions: the unused `scripting` and `activeTab` permissions are gone, leaving only `storage` and `contextMenus`.

**Look**
- The new ClearPath logo on the toolbar icon, the popup and the Reading Mode header.
- The popup uses the brand fonts (DM Sans and DM Serif Display, bundled with the extension) and the website's colors, and shows the real version number.

458 tests across 18 files; 93% statement and 99.7% branch coverage.

### v0.6.0 — Vocabulary Support *(2026-04-08)*
- Double-click any word to see a plain-English definition in a Shadow DOM tooltip
- 21,881-entry offline dictionary bundled with the extension (562 KB gzip) — no API required
- Dictionary derived from Simple English Wiktionary XML dump via `scripts/build-dictionary.js`
- Symbol Overlay pictograms (99 PNGs in `public/symbols/`) downloaded from the ARASAAC API via `scripts/fetch-symbols.js`; the chosen pictogram id per word is pinned in `public/symbols/index.json`
- Lazy loading: dictionary only fetches on first double-click, then cached for the session
- Dismiss with Escape or click outside; toggle from popup or right-click context menu
- 100% test coverage (414 tests across 17 files)

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

## Roadmap

| Phase | Feature | Status |
|---|---|---|
| 1 | Read Aloud | ✅ v0.1.0 |
| 2 | LLM Simplification | ✅ v0.2.0 |
| 3 | Reading Mode | ✅ v0.3.0 |
| 4 | Focus Tools | ✅ v0.4.0 |
| 5 | Profiles & Symbol Overlay | ✅ v0.5.0 |
| 6 | Vocabulary Support (offline dictionary, double-click definitions) | ✅ v0.6.0 |
| 7 | Polish (accessibility pass: keyboard, screen readers, WCAG AA contrast) | ✅ v0.7.0 |
| 8 | Onboarding (first-run welcome, tools tour, optional API key setup) | 🗓 [v0.8.0](https://github.com/clearpath-ext/clearpath-extension/milestone/1) |
| 9 | Polish + security audit | 🗓 [v0.9.0](https://github.com/clearpath-ext/clearpath-extension/milestone/2) |
| 10 | Launch: Chrome Web Store listing | 🗓 [v1.0.0](https://github.com/clearpath-ext/clearpath-extension/milestone/3) |

After v1.0: Firefox support and the Firefox Add-ons listing.

---

## Privacy

- Zero data collection. No analytics, no telemetry, no tracking of any kind.
- Settings stored via `chrome.storage.sync` — synced to your browser account, not our servers. Your LLM API key stays on the device you entered it on (`chrome.storage.local`) and is never put in exported profiles.
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
