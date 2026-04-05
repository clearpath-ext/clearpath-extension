import { Readability } from '@mozilla/readability'
import { getSettings, setSettings } from '../lib/storage'
import type { Settings, ReaderFont, ReaderTheme, ReaderColumnWidth } from '../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReaderCallbacks {
  onClose(): void
}

// ── Module state ──────────────────────────────────────────────────────────────

let host: HTMLElement | null = null
let shadow: ShadowRoot | null = null
let articleContentEl: HTMLElement | null = null
let callbacks: ReaderCallbacks | null = null
let spokenText = ''

// ── Font stacks ───────────────────────────────────────────────────────────────

const FONT_STACKS: Record<ReaderFont, string> = {
  system: 'system-ui, -apple-system, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'Arial, Helvetica, sans-serif',
  dyslexic: '"OpenDyslexic", Arial, sans-serif',
}

const COLUMN_WIDTHS: Record<ReaderColumnWidth, string> = {
  narrow: '45ch',
  medium: '65ch',
  wide: '85ch',
}

// ── CSS ───────────────────────────────────────────────────────────────────────

function buildCSS(settings: Settings): string {
  const fontUrl = chrome.runtime.getURL('fonts/OpenDyslexic-Regular.woff2')
  return `
    @font-face {
      font-family: 'OpenDyslexic';
      src: url('${fontUrl}') format('woff2');
      font-weight: normal;
      font-style: normal;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .cp-reader {
      display: flex;
      flex-direction: column;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      font-family: ${FONT_STACKS[settings.readerFont]};
      font-size: ${settings.readerFontSize}px;
      line-height: ${settings.readerLineHeight};
    }

    /* ── Themes ── */
    .cp-theme-light  { background: #ffffff; color: #1a1a1a; }
    .cp-theme-dark   { background: #18181b; color: #e4e4e7; }
    .cp-theme-sepia  { background: #f5efe3; color: #3b2c1a; }
    .cp-theme-contrast { background: #000000; color: #ffff00; }

    /* ── Header ── */
    .cp-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 20px;
      height: 52px;
      border-bottom: 1px solid rgba(128,128,128,0.2);
      font-family: system-ui, -apple-system, sans-serif;
    }
    .cp-theme-light   .cp-header { background: #f5f5f5; }
    .cp-theme-dark    .cp-header { background: #09090b; }
    .cp-theme-sepia   .cp-header { background: #ede3c8; }
    .cp-theme-contrast .cp-header { background: #111; border-color: #333; }

    .cp-brand {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }
    .cp-brand-icon {
      width: 20px;
      height: 20px;
      border-radius: 5px;
      background: linear-gradient(135deg, #5B9BF8, #34D399);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 9px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .cp-theme-light    .cp-brand { color: #374151; }
    .cp-theme-dark     .cp-brand { color: #a1a1aa; }
    .cp-theme-sepia    .cp-brand { color: #5c4a32; }
    .cp-theme-contrast .cp-brand { color: #aaa; }

    .cp-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      flex: 1;
    }

    .cp-sep {
      width: 1px;
      height: 20px;
      background: rgba(128,128,128,0.25);
      flex-shrink: 0;
    }

    .cp-select {
      height: 28px;
      padding: 0 6px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      border: 1px solid rgba(128,128,128,0.3);
    }
    .cp-theme-light    .cp-select { background: #fff; color: #374151; }
    .cp-theme-dark     .cp-select { background: #27272a; color: #e4e4e7; }
    .cp-theme-sepia    .cp-select { background: #ede3c8; color: #3b2c1a; }
    .cp-theme-contrast .cp-select { background: #222; color: #ffff00; border-color: #555; }

    .cp-btn-group {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .cp-btn {
      height: 28px;
      padding: 0 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid rgba(128,128,128,0.3);
      transition: background 0.15s;
    }
    .cp-theme-light    .cp-btn { background: #fff; color: #374151; }
    .cp-theme-dark     .cp-btn { background: #27272a; color: #e4e4e7; }
    .cp-theme-sepia    .cp-btn { background: #ede3c8; color: #3b2c1a; }
    .cp-theme-contrast .cp-btn { background: #222; color: #ffff00; border-color: #555; }
    .cp-btn:hover { opacity: 0.75; }
    .cp-btn:focus-visible { outline: 2px solid #5B9BF8; outline-offset: 2px; }

    .cp-btn[aria-pressed="true"] {
      background: #5B9BF8;
      color: #fff;
      border-color: #5B9BF8;
    }
    .cp-theme-contrast .cp-btn[aria-pressed="true"] { background: #ffff00; color: #000; border-color: #ffff00; }

    .cp-theme-dots {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .cp-theme-dot {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid transparent;
      padding: 0;
      transition: transform 0.1s;
    }
    .cp-theme-dot:hover { transform: scale(1.15); }
    .cp-theme-dot:focus-visible { outline: 2px solid #5B9BF8; outline-offset: 2px; }
    .cp-theme-dot[aria-pressed="true"] { border-color: #5B9BF8; transform: scale(1.1); }
    .cp-theme-dot[data-theme="light"]    { background: #ffffff; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2); }
    .cp-theme-dot[data-theme="dark"]     { background: #18181b; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2); }
    .cp-theme-dot[data-theme="sepia"]    { background: #f5efe3; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2); }
    .cp-theme-dot[data-theme="contrast"] { background: #000; box-shadow: inset 0 0 0 1px #ffff00; }

    .cp-spacer { flex: 1; }

    .cp-close {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: none;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .cp-theme-light    .cp-close { background: transparent; color: #6b7280; }
    .cp-theme-dark     .cp-close { background: transparent; color: #71717a; }
    .cp-theme-sepia    .cp-close { background: transparent; color: #7c6a52; }
    .cp-theme-contrast .cp-close { background: transparent; color: #aaa; }
    .cp-close:hover { background: rgba(128,128,128,0.15); }
    .cp-close:focus-visible { outline: 2px solid #5B9BF8; outline-offset: 2px; }

    /* ── Scroll area ── */
    .cp-scroll {
      flex: 1;
      overflow-y: auto;
    }

    /* ── Article content ── */
    .cp-content {
      max-width: ${COLUMN_WIDTHS[settings.readerColumnWidth]};
      margin: 0 auto;
      padding: 2.5rem 1.5rem 4rem;
    }

    .cp-article-title {
      font-size: 1.75em;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 0.5rem;
    }

    .cp-byline {
      font-size: 0.875em;
      opacity: 0.6;
      margin-bottom: 1rem;
    }

    .cp-divider {
      border: none;
      border-top: 1px solid rgba(128,128,128,0.25);
      margin: 0 0 1.5rem;
    }

    .cp-body { }

    .cp-body p { margin-bottom: 1em; }
    .cp-body h1, .cp-body h2, .cp-body h3,
    .cp-body h4, .cp-body h5, .cp-body h6 {
      font-weight: 700;
      margin: 1.25em 0 0.5em;
      line-height: 1.3;
    }
    .cp-body h1 { font-size: 1.5em; }
    .cp-body h2 { font-size: 1.3em; }
    .cp-body h3 { font-size: 1.15em; }
    .cp-body ul, .cp-body ol { padding-left: 1.5em; margin-bottom: 1em; }
    .cp-body li { margin-bottom: 0.25em; }
    .cp-body blockquote {
      border-left: 3px solid rgba(128,128,128,0.4);
      padding-left: 1em;
      opacity: 0.8;
      margin: 1em 0;
    }
    .cp-body a { color: #5B9BF8; }
    .cp-theme-contrast .cp-body a { color: #87ceeb; }
    .cp-body img { max-width: 100%; border-radius: 4px; }
    .cp-body figure { margin: 1em 0; }
    .cp-body figcaption { font-size: 0.85em; opacity: 0.6; margin-top: 0.4em; }
    .cp-body pre { overflow-x: auto; padding: 1em; border-radius: 6px; background: rgba(128,128,128,0.1); }
    .cp-body code { font-family: monospace; font-size: 0.9em; }

    /* ── Word highlighting ── */
    .cp-word { border-radius: 3px; transition: background-color 0.08s; }
    .cp-word.cp-active { background-color: rgba(91, 155, 248, 0.35); }
    .cp-theme-sepia    .cp-word.cp-active { background-color: rgba(180, 120, 60, 0.3); }
    .cp-theme-dark     .cp-word.cp-active { background-color: rgba(91, 155, 248, 0.4); }
    .cp-theme-contrast .cp-word.cp-active { background-color: rgba(255, 255, 0, 0.4); color: #000; }
  `
}

// ── Sanitize HTML ─────────────────────────────────────────────────────────────

function sanitizeHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  doc.querySelectorAll('script,iframe,object,embed').forEach((el) => el.remove())
  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
    })
  })
  return doc.body.innerHTML
}

// ── Header DOM builder ────────────────────────────────────────────────────────

function buildHeader(settings: Settings, onSettingChange: (patch: Partial<Settings>) => void): HTMLElement {
  const header = document.createElement('header')
  header.className = 'cp-header'
  header.setAttribute('role', 'toolbar')
  header.setAttribute('aria-label', 'Reading Mode controls')

  // Brand
  const brand = document.createElement('div')
  brand.className = 'cp-brand'
  const icon = document.createElement('div')
  icon.className = 'cp-brand-icon'
  icon.textContent = 'CP'
  icon.setAttribute('aria-hidden', 'true')
  const brandLabel = document.createElement('span')
  brandLabel.textContent = 'Reading Mode'
  brand.appendChild(icon)
  brand.appendChild(brandLabel)
  header.appendChild(brand)

  const sep1 = document.createElement('div')
  sep1.className = 'cp-sep'
  sep1.setAttribute('aria-hidden', 'true')
  header.appendChild(sep1)

  // Controls
  const controls = document.createElement('div')
  controls.className = 'cp-controls'

  // Font selector
  const fontLabel = document.createElement('label')
  fontLabel.className = 'cp-visually-hidden'
  fontLabel.setAttribute('for', 'cp-font-select')
  fontLabel.textContent = 'Font'
  fontLabel.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap'

  const fontSelect = document.createElement('select')
  fontSelect.id = 'cp-font-select'
  fontSelect.className = 'cp-select'
  fontSelect.setAttribute('aria-label', 'Font family');
  ([
    ['system', 'System'],
    ['serif', 'Serif'],
    ['sans', 'Sans'],
    ['dyslexic', 'OpenDyslexic'],
  ] as [ReaderFont, string][]).forEach(([val, label]) => {
    const opt = document.createElement('option')
    opt.value = val
    opt.textContent = label
    opt.selected = settings.readerFont === val
    fontSelect.appendChild(opt)
  })
  fontSelect.addEventListener('change', () => {
    void onSettingChange({ readerFont: fontSelect.value as ReaderFont })
  })
  controls.appendChild(fontLabel)
  controls.appendChild(fontSelect)

  // Font size A− / A+
  const sizeSizes = [16, 18, 20, 22, 24]
  const sizeGroup = document.createElement('div')
  sizeGroup.className = 'cp-btn-group'
  sizeGroup.setAttribute('role', 'group')
  sizeGroup.setAttribute('aria-label', 'Font size')

  const sizeDecBtn = document.createElement('button')
  sizeDecBtn.className = 'cp-btn'
  sizeDecBtn.id = 'cp-size-dec'
  sizeDecBtn.textContent = 'A−'
  sizeDecBtn.setAttribute('aria-label', 'Decrease font size')
  sizeDecBtn.addEventListener('click', () => {
    const cur = sizeSizes.indexOf(settings.readerFontSize)
    if (cur > 0) void onSettingChange({ readerFontSize: sizeSizes[cur - 1] })
  })

  const sizeIncBtn = document.createElement('button')
  sizeIncBtn.className = 'cp-btn'
  sizeIncBtn.id = 'cp-size-inc'
  sizeIncBtn.textContent = 'A+'
  sizeIncBtn.setAttribute('aria-label', 'Increase font size')
  sizeIncBtn.addEventListener('click', () => {
    const cur = sizeSizes.indexOf(settings.readerFontSize)
    if (cur < sizeSizes.length - 1) void onSettingChange({ readerFontSize: sizeSizes[cur + 1] })
  })

  sizeGroup.appendChild(sizeDecBtn)
  sizeGroup.appendChild(sizeIncBtn)
  controls.appendChild(sizeGroup)

  // Column width
  const widthGroup = document.createElement('div')
  widthGroup.className = 'cp-btn-group'
  widthGroup.setAttribute('role', 'group')
  widthGroup.setAttribute('aria-label', 'Column width');
  ([
    ['narrow', '⊟', 'Narrow'],
    ['medium', '⊠', 'Medium'],
    ['wide', '⊞', 'Wide'],
  ] as [ReaderColumnWidth, string, string][]).forEach(([val, symbol, label]) => {
    const btn = document.createElement('button')
    btn.className = 'cp-btn'
    btn.dataset.width = val
    btn.textContent = symbol
    btn.setAttribute('aria-label', `${label} column width`)
    btn.setAttribute('aria-pressed', String(settings.readerColumnWidth === val))
    btn.addEventListener('click', () => {
      void onSettingChange({ readerColumnWidth: val })
    })
    widthGroup.appendChild(btn)
  })
  controls.appendChild(widthGroup)

  // Theme dots
  const themeGroup = document.createElement('div')
  themeGroup.className = 'cp-theme-dots'
  themeGroup.setAttribute('role', 'group')
  themeGroup.setAttribute('aria-label', 'Theme');
  ([
    ['light', 'Light'],
    ['dark', 'Dark'],
    ['sepia', 'Sepia'],
    ['contrast', 'High contrast'],
  ] as [ReaderTheme, string][]).forEach(([val, label]) => {
    const btn = document.createElement('button')
    btn.className = 'cp-theme-dot'
    btn.dataset.theme = val
    btn.setAttribute('aria-label', `${label} theme`)
    btn.setAttribute('aria-pressed', String(settings.readerTheme === val))
    btn.addEventListener('click', () => {
      void onSettingChange({ readerTheme: val })
    })
    themeGroup.appendChild(btn)
  })
  controls.appendChild(themeGroup)

  // Spacer pushes close to far right
  const spacer = document.createElement('div')
  spacer.className = 'cp-spacer'
  spacer.setAttribute('aria-hidden', 'true')
  controls.appendChild(spacer)

  header.appendChild(controls)

  // Close button
  const closeBtn = document.createElement('button')
  closeBtn.className = 'cp-close'
  closeBtn.id = 'cp-reader-close'
  closeBtn.setAttribute('aria-label', 'Close reading mode')
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', () => close())
  header.appendChild(closeBtn)

  return header
}

// ── Public API ────────────────────────────────────────────────────────────────

export function init(cbs: ReaderCallbacks): void {
  callbacks = cbs
}

function wordCount(text: string): number {
  /* v8 ignore next -- spokenText is always a non-empty string at this call site */
  return text ? text.split(/\s+/).filter(Boolean).length : 0
}

export function isOpen(): boolean {
  return host !== null
}

export function getContentEl(): HTMLElement | null {
  return articleContentEl
}

export function getSpokenText(): string {
  return spokenText
}

export async function open(): Promise<void> {
  if (host) return

  // Extract article
  const docClone = document.cloneNode(true) as Document
  const article = new Readability(docClone).parse()
  if (!article) {
    console.debug('[ClearPath] Reader: Readability could not parse an article from this page')
    return
  }

  console.debug('[ClearPath] Reader: opening — title:', article.title)
  const settings = await getSettings()

  // Build shadow host
  host = document.createElement('div')
  host.id = 'clearpath-reader-host'
  shadow = host.attachShadow({ mode: 'open' })

  // Style element
  const styleEl = document.createElement('style')
  styleEl.textContent = buildCSS(settings)

  // Outer container (theme class applied here)
  const container = document.createElement('div')
  container.className = `cp-reader cp-theme-${settings.readerTheme}`
  container.setAttribute('role', 'main')
  container.setAttribute('aria-label', 'Reading Mode')

  // Handle setting changes from header controls
  const handleSettingChange = async (patch: Partial<Settings>): Promise<void> => {
    await setSettings(patch)
    const updated = await getSettings()
    updateStyle(updated)
  }

  // Header
  const headerEl = buildHeader(settings, handleSettingChange)

  // Scroll area
  const scrollEl = document.createElement('div')
  scrollEl.className = 'cp-scroll'

  // Content wrapper
  const contentWrapper = document.createElement('div')
  contentWrapper.className = 'cp-content'

  // Title
  const titleEl = document.createElement('h1')
  titleEl.className = 'cp-article-title'
  /* v8 ignore next -- article.title is always a string per Readability */
  titleEl.textContent = article.title ?? ''

  contentWrapper.appendChild(titleEl)

  // Byline
  if (article.byline) {
    const bylineEl = document.createElement('p')
    bylineEl.className = 'cp-byline'
    bylineEl.textContent = article.byline
    contentWrapper.appendChild(bylineEl)
  }

  // Divider
  const hrEl = document.createElement('hr')
  hrEl.className = 'cp-divider'
  contentWrapper.appendChild(hrEl)

  // Article body — sanitized Readability HTML
  articleContentEl = document.createElement('div')
  articleContentEl.className = 'cp-body'
  /* v8 ignore next -- article.content is always a string per Readability */
  articleContentEl.innerHTML = sanitizeHtml(article.content ?? '')

  contentWrapper.appendChild(articleContentEl)
  scrollEl.appendChild(contentWrapper)

  container.appendChild(styleEl)
  container.appendChild(headerEl)
  container.appendChild(scrollEl)
  shadow.appendChild(container)
  document.body.appendChild(host)

  // Capture spoken text from the rendered content
  /* v8 ignore next -- textContent is never null on an HTMLElement */
  spokenText = articleContentEl.textContent?.replace(/\s+/g, ' ').trim() ?? ''

  // Prevent body scroll while reader is open
  document.body.style.overflow = 'hidden'
  console.debug('[ClearPath] Reader: open — words:', wordCount(spokenText))
}

export function close(): void {
  if (!host) return
  console.debug('[ClearPath] Reader: closing')
  host.remove()
  host = null
  shadow = null
  articleContentEl = null
  spokenText = ''
  document.body.style.overflow = ''
  callbacks?.onClose()
}

export function updateStyle(settings: Settings): void {
  if (!shadow) return
  console.debug('[ClearPath] Reader: updateStyle — theme:', settings.readerTheme, 'font:', settings.readerFont)

  // Rebuild CSS
  const styleEl = shadow.querySelector('style')
  if (styleEl) styleEl.textContent = buildCSS(settings)

  // Update theme class on container
  const container = shadow.querySelector('.cp-reader') as HTMLElement | null
  if (container) {
    container.className = `cp-reader cp-theme-${settings.readerTheme}`
  }

  // Update column width on content wrapper
  const contentWrapper = shadow.querySelector('.cp-content') as HTMLElement | null
  if (contentWrapper) {
    contentWrapper.style.maxWidth = COLUMN_WIDTHS[settings.readerColumnWidth]
  }

  // Sync font select
  const fontSelect = shadow.getElementById('cp-font-select') as HTMLSelectElement | null
  if (fontSelect) fontSelect.value = settings.readerFont

  // Sync width button pressed states
  shadow.querySelectorAll('[data-width]').forEach((btn) => {
    btn.setAttribute(
      'aria-pressed',
      String((btn as HTMLElement).dataset.width === settings.readerColumnWidth),
    )
  })

  // Sync theme dot pressed states
  shadow.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.setAttribute(
      'aria-pressed',
      String((btn as HTMLElement).dataset.theme === settings.readerTheme),
    )
  })
}
