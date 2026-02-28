# Contributing to ClearPath

Thank you for your interest in contributing. ClearPath is community-built, and every contribution matters — whether you're fixing a typo, building a feature, or testing with real users.

This guide will get you from zero to a merged pull request as efficiently as possible.

---

## Ways to Contribute

You don't have to be a developer to make a meaningful contribution.

| Role | How You Can Help |
|---|---|
| **Developer** | Build features, fix bugs, improve performance, write tests |
| **Designer** | Improve UI, create icons, work on symbol visuals |
| **SLP / AAC Specialist** | Review symbol accuracy, advise on accessibility UX, test with users |
| **Writer** | Improve documentation, write plain-language guides, translate |
| **User** | Report bugs, suggest features, share your experience |

---

## Before You Start

- Browse [open issues](https://github.com/clearpath-ext/clearpath-extension/issues)
- Issues labeled [`good first issue`](https://github.com/clearpath-ext/clearpath-extension/labels/good%20first%20issue) are the best place to start
- Issues labeled [`help wanted`](https://github.com/clearpath-ext/clearpath-extension/labels/help%20wanted) are priorities we'd love help with
- For large changes, open an issue or Discussion first so we can align before you invest time building

---

## Local Development Setup

### Prerequisites
- Node.js 18+
- npm 9+
- Chrome or Firefox (for testing)

### Setup

```bash
# Clone the repo
git clone https://github.com/clearpath-ext/clearpath-extension.git
cd clearpath-extension

# Install dependencies
pnpm install

# Start development build (hot reload enabled)
pnpm dev
```

### Loading the Extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer Mode** (toggle in top right)
3. Click **Load Unpacked**
4. Select the `/dist` folder from the project root

Every time you save a file, the extension hot-reloads automatically via CRXJS.

### Loading in Firefox

```bash
pnpm build:firefox
```

1. Open `about:debugging`
2. Click **This Firefox → Load Temporary Add-on**
3. Select `dist/manifest.json`

---

## Project Architecture

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a full breakdown. The short version:

- `src/background/` — Service worker. Handles context menus and routes messages between the popup and content scripts.
- `src/content/` — Everything injected into pages: the toolbar, overlay, reading mode, TTS controller, symbol overlay.
- `src/popup/` — The extension popup UI (what appears when you click the icon).
- `src/options/` — The full settings/options page.
- `src/lib/` — Shared logic: LLM API abstraction, storage helpers, simplification prompts, dictionary.

Chrome extensions have three isolated JavaScript contexts (background, content, popup) that communicate via `chrome.runtime.sendMessage`. If you're new to extension development, read [ARCHITECTURE.md](docs/ARCHITECTURE.md) before diving in — it'll save you a lot of confusion.

---

## Development Guidelines

### Code Style
- TypeScript everywhere — no plain JS files
- Run `pnpm lint` before committing; CI will reject lint failures
- Format with Prettier: `pnpm format`
- Component files: PascalCase (`OverlayPanel.tsx`)
- Utility files: camelCase (`simplify.ts`)

### Accessibility (Required)
ClearPath's own UI must be accessible. All new UI must:
- Be keyboard navigable
- Have appropriate ARIA labels
- Meet WCAG 2.1 AA contrast ratios
- Be tested with a screen reader before submitting

Run `pnpm a11y` for an automated accessibility audit.

### Testing
- Write unit tests for anything in `src/lib/`
- Write E2E tests (Playwright) for new user-facing features
- Run tests: `pnpm test`
- Run E2E: `pnpm test:e2e`

Tests must pass before a PR can be merged.

### Commit Messages
Use conventional commits:
```
feat: add reading ruler to focus mode
fix: correct word boundary event timing in TTS
docs: update API setup guide for Anthropic
chore: upgrade Vite to 5.2
```

---

## Pull Request Process

1. Fork the repo and create a branch: `git checkout -b feat/your-feature-name`
2. Make your changes
3. Run `pnpm lint && pnpm test`
4. Push and open a PR against `main`
5. Fill out the PR template completely
6. A maintainer will review within 3–5 business days

### PR Requirements Checklist
- [ ] Lint passes
- [ ] Tests pass (and new tests added for new features)
- [ ] Accessibility checked for any UI changes
- [ ] Docs updated if behavior changed
- [ ] PR description explains *what* changed and *why*

---

## Adding Symbols

If you want to contribute to the symbol library, see the [clearpath-symbols repo](https://github.com/clearpath-ext/clearpath-symbols) and its [CONTRIBUTING.md](https://github.com/clearpath-ext/clearpath-symbols/blob/main/CONTRIBUTING.md). Symbol contributions are extremely valuable and don't require any programming knowledge.

---

## Reporting Bugs

Use the [bug report template](https://github.com/clearpath-ext/clearpath-extension/issues/new?template=bug_report.md). Please include:
- Browser and OS
- Extension version
- Steps to reproduce
- What you expected vs. what happened
- Screenshot or screen recording if possible

---

## Suggesting Features

Use the [feature request template](https://github.com/clearpath-ext/clearpath-extension/issues/new?template=feature_request.md) or start a [Discussion](https://github.com/clearpath-ext/clearpath-extension/discussions/new?category=ideas).

---

## Code of Conduct

ClearPath is a welcoming, inclusive project. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Be kind, assume good intent, and remember that many of our users and contributors have disabilities — language and tone matter here.

---

## Questions?

Open a [Discussion](https://github.com/clearpath-ext/clearpath-extension/discussions) — we're happy to help you get started.
