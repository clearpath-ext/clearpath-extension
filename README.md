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

  <img src="docs/assets/demo.gif" alt="ClearPath demo showing text being simplified and read aloud on a webpage" width="680"/>
</div>

---

## Why ClearPath?

The web was built for people who can read dense text quickly, understand jargon, and process visually complex layouts. That's not everyone.

ClearPath is a browser extension that lets you — or someone you care for — experience any webpage differently. Select text and simplify it. Have a page read aloud with word-by-word highlighting. Switch into a clean reading mode with a dyslexia-friendly font. Overlay AAC symbols above words.

No account. No data collection. No server. It all runs in your browser.

---

## Features

### Read Aloud
Reads any selected text or full page content using your browser's built-in text-to-speech. Words are highlighted as they're spoken. Fully configurable: voice, speed, pitch. Works offline.

### Simplify
Select any text, right-click, and choose Simplify. The text is rewritten in plain English at your chosen reading level (Grade 3, 5, or 8) using an LLM. Works with your own OpenAI or Anthropic API key, or locally with Ollama — your text never touches our servers.

### Reading Mode
Strips a page down to its main content. Apply custom typography: font family (including OpenDyslexic), size, line spacing, letter spacing. Choose from six color themes. Saved per-site.

### Symbol Overlay
Displays AAC-style pictogram symbols above words on any page, powered by the open ARASAAC symbol library. Configurable density: key words only, or all supported words. Designed for AAC users and the people who support them.

### Focus Tools
- Reading ruler — a colored band that follows your cursor, helping you track lines
- Paragraph focus — dims everything on the page except where you're reading
- Word complexity — underlines hard words and shows simpler alternatives on hover

### Vocabulary Support
Double-click any word for an instant plain-English definition. No API required — powered by an embedded open dictionary.

### Profiles
Create named accessibility profiles, save all settings, and export them as JSON to share. Ideal for SLPs configuring settings for a client, or caregivers setting up a device for a family member.

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

Read Aloud, Reading Mode, and Focus Tools work immediately with no setup.

Simplify and Summarize require an LLM API key, or a local Ollama instance. Your text goes directly from your browser to your chosen API — it never passes through any ClearPath server.

1. Open the extension popup → click the Settings icon
2. Choose your provider: OpenAI, Anthropic, or Ollama (local)
3. Paste your API key
4. Done — Simplify is now active

---

## Tech Stack

| | |
|---|---|
| Language | TypeScript |
| Build | Vite + CRXJS |
| UI | React + Tailwind CSS |
| State | Zustand |
| TTS | Web Speech API |
| Content Extraction | Mozilla Readability.js |
| Dictionary | Embedded WordNet subset |
| Testing | Vitest + Playwright |
| CI/CD | GitHub Actions |
| Package Manager | pnpm |

---

## Project Structure

```
src/
├── background/       # Service worker (context menus, message routing)
├── content/          # Scripts injected into pages
│   ├── toolbar.tsx   # Floating toolbar
│   ├── overlay.tsx   # Simplification result panel
│   ├── reader.tsx    # Reading mode
│   ├── tts.ts        # Text-to-speech controller
│   └── symbols.ts    # Symbol overlay
├── popup/            # Extension popup UI
├── options/          # Full settings page
└── lib/              # Shared logic (API, simplification, storage)
```

---

## Contributing

ClearPath welcomes contributions from everyone — developers, designers, SLPs, AAC specialists, and people with lived experience of disability.

Quick start:
1. Browse [`good first issue`](https://github.com/clearpath-ext/clearpath-extension/labels/good%20first%20issue) for beginner-friendly tasks
2. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines
3. Join the conversation in [Discussions](https://github.com/clearpath-ext/clearpath-extension/discussions)

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
