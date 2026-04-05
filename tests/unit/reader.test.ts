import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/shared/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockGetSettings, mockSetSettings } = vi.hoisted(() => ({
  mockGetSettings: vi.fn(),
  mockSetSettings: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../src/lib/storage', () => ({
  getSettings: mockGetSettings,
  setSettings: mockSetSettings,
}))

const mockReadabilityParse = vi.fn()
vi.mock('@mozilla/readability', () => ({
  Readability: vi.fn().mockImplementation(() => ({ parse: mockReadabilityParse })),
}))

// chrome.runtime.getURL already mocked in setup.ts
// Ensure it returns a string
vi.mocked(chrome.runtime.getURL).mockReturnValue('chrome-extension://test/fonts/OpenDyslexic-Regular.woff2')

import * as reader from '../../src/content/reader'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_SETTINGS = {
  ...DEFAULT_SETTINGS,
  readerFont: 'system' as const,
  readerFontSize: 18,
  readerLineHeight: 1.75,
  readerTheme: 'light' as const,
  readerColumnWidth: 'medium' as const,
}

const MOCK_ARTICLE = {
  title: 'Test Article',
  byline: 'By Author',
  content: '<p>Hello world</p>',
  textContent: 'Hello world',
}

function getShadow(): ShadowRoot | null {
  return document.getElementById('clearpath-reader-host')?.shadowRoot ?? null
}

describe('reader', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(chrome.runtime.getURL).mockReturnValue(
      'chrome-extension://test/fonts/OpenDyslexic-Regular.woff2',
    )
    mockGetSettings.mockResolvedValue({ ...BASE_SETTINGS })
    mockSetSettings.mockResolvedValue(undefined)
    mockReadabilityParse.mockReturnValue({ ...MOCK_ARTICLE })
    reader.init({ onClose })
    document.body.innerHTML = ''
    document.body.style.overflow = ''
  })

  afterEach(() => {
    reader.close()
  })

  // ── isOpen ─────────────────────────────────────────────────────────────────

  it('isOpen() returns false before any open() call', () => {
    expect(reader.isOpen()).toBe(false)
  })

  it('isOpen() returns true after open()', async () => {
    await reader.open()
    expect(reader.isOpen()).toBe(true)
  })

  it('isOpen() returns false after close()', async () => {
    await reader.open()
    reader.close()
    expect(reader.isOpen()).toBe(false)
  })

  // ── open ───────────────────────────────────────────────────────────────────

  it('does nothing when Readability returns null', async () => {
    mockReadabilityParse.mockReturnValue(null)
    await reader.open()
    expect(reader.isOpen()).toBe(false)
    expect(document.getElementById('clearpath-reader-host')).toBeNull()
  })

  it('appends host element to the document body', async () => {
    await reader.open()
    expect(document.getElementById('clearpath-reader-host')).toBeTruthy()
  })

  it('creates a shadow root on the host', async () => {
    await reader.open()
    const shadow = getShadow()
    expect(shadow).toBeTruthy()
  })

  it('sets document.body.overflow to hidden while open', async () => {
    await reader.open()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('is idempotent — calling open() twice does not create a second host', async () => {
    await reader.open()
    await reader.open()
    expect(document.querySelectorAll('#clearpath-reader-host')).toHaveLength(1)
  })

  it('renders the article title', async () => {
    await reader.open()
    const shadow = getShadow()!
    const title = shadow.querySelector('.cp-article-title')
    expect(title?.textContent).toBe('Test Article')
  })

  it('renders the byline when present', async () => {
    await reader.open()
    const shadow = getShadow()!
    const byline = shadow.querySelector('.cp-byline')
    expect(byline?.textContent).toBe('By Author')
  })

  it('omits the byline when article has no byline', async () => {
    mockReadabilityParse.mockReturnValue({ ...MOCK_ARTICLE, byline: null })
    await reader.open()
    const shadow = getShadow()!
    expect(shadow.querySelector('.cp-byline')).toBeNull()
  })

  it('renders article content via innerHTML', async () => {
    mockReadabilityParse.mockReturnValue({
      ...MOCK_ARTICLE,
      content: '<p>Article body text</p>',
    })
    await reader.open()
    const shadow = getShadow()!
    expect(shadow.querySelector('.cp-body')?.textContent).toContain('Article body text')
  })

  it('sanitizes script tags from content', async () => {
    mockReadabilityParse.mockReturnValue({
      ...MOCK_ARTICLE,
      content: '<p>Safe text</p><script>evil()</script>',
    })
    await reader.open()
    const shadow = getShadow()!
    expect(shadow.querySelector('.cp-body script')).toBeNull()
    expect(shadow.querySelector('.cp-body p')?.textContent).toBe('Safe text')
  })

  it('sanitizes iframes from content', async () => {
    mockReadabilityParse.mockReturnValue({
      ...MOCK_ARTICLE,
      content: '<p>text</p><iframe src="evil.com"></iframe>',
    })
    await reader.open()
    const shadow = getShadow()!
    expect(shadow.querySelector('.cp-body iframe')).toBeNull()
  })

  it('sanitizes on* event handler attributes', async () => {
    mockReadabilityParse.mockReturnValue({
      ...MOCK_ARTICLE,
      content: '<p onclick="evil()">text</p>',
    })
    await reader.open()
    const shadow = getShadow()!
    const p = shadow.querySelector('.cp-body p')
    expect(p?.getAttribute('onclick')).toBeNull()
  })

  it('applies the theme class from settings', async () => {
    mockGetSettings.mockResolvedValue({ ...BASE_SETTINGS, readerTheme: 'dark' })
    await reader.open()
    const shadow = getShadow()!
    expect(shadow.querySelector('.cp-theme-dark')).toBeTruthy()
  })

  // ── getSpokenText / getContentEl ───────────────────────────────────────────

  it('getSpokenText() returns empty string before open', () => {
    expect(reader.getSpokenText()).toBe('')
  })

  it('getSpokenText() returns extracted article text after open', async () => {
    mockReadabilityParse.mockReturnValue({
      ...MOCK_ARTICLE,
      content: '<p>Hello world</p>',
    })
    await reader.open()
    // getSpokenText is derived from contentEl.textContent
    expect(reader.getSpokenText()).toContain('Hello')
  })

  it('getContentEl() returns null before open', () => {
    expect(reader.getContentEl()).toBeNull()
  })

  it('getContentEl() returns a non-null element after open', async () => {
    await reader.open()
    expect(reader.getContentEl()).toBeTruthy()
  })

  it('getContentEl() returns null after close', async () => {
    await reader.open()
    reader.close()
    expect(reader.getContentEl()).toBeNull()
  })

  // ── close ──────────────────────────────────────────────────────────────────

  it('removes the host element on close', async () => {
    await reader.open()
    reader.close()
    expect(document.getElementById('clearpath-reader-host')).toBeNull()
  })

  it('restores document.body.overflow on close', async () => {
    await reader.open()
    reader.close()
    expect(document.body.style.overflow).toBe('')
  })

  it('calls the onClose callback', async () => {
    await reader.open()
    reader.close()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('close() is a no-op when not open', () => {
    expect(() => reader.close()).not.toThrow()
    expect(onClose).not.toHaveBeenCalled()
  })

  // ── updateStyle ────────────────────────────────────────────────────────────

  it('updateStyle() is a no-op when not open', () => {
    expect(() => reader.updateStyle(BASE_SETTINGS)).not.toThrow()
  })

  it('updateStyle() changes the theme class', async () => {
    await reader.open()
    reader.updateStyle({ ...BASE_SETTINGS, readerTheme: 'sepia' })
    const shadow = getShadow()!
    expect(shadow.querySelector('.cp-theme-sepia')).toBeTruthy()
    expect(shadow.querySelector('.cp-theme-light')).toBeNull()
  })

  it('updateStyle() updates the style element', async () => {
    await reader.open()
    const shadow = getShadow()!
    const styleBefore = shadow.querySelector('style')?.textContent ?? ''
    reader.updateStyle({ ...BASE_SETTINGS, readerFont: 'dyslexic' })
    const styleAfter = shadow.querySelector('style')?.textContent ?? ''
    expect(styleAfter).not.toBe(styleBefore)
    expect(styleAfter).toContain('OpenDyslexic')
  })

  it('updateStyle() syncs font select value', async () => {
    await reader.open()
    reader.updateStyle({ ...BASE_SETTINGS, readerFont: 'serif' })
    const shadow = getShadow()!
    const select = shadow.getElementById('cp-font-select') as HTMLSelectElement
    expect(select.value).toBe('serif')
  })

  it('updateStyle() syncs width button aria-pressed states', async () => {
    await reader.open()
    reader.updateStyle({ ...BASE_SETTINGS, readerColumnWidth: 'wide' })
    const shadow = getShadow()!
    const wideBtn = shadow.querySelector('[data-width="wide"]')
    const mediumBtn = shadow.querySelector('[data-width="medium"]')
    expect(wideBtn?.getAttribute('aria-pressed')).toBe('true')
    expect(mediumBtn?.getAttribute('aria-pressed')).toBe('false')
  })

  it('updateStyle() syncs theme dot aria-pressed states', async () => {
    await reader.open()
    reader.updateStyle({ ...BASE_SETTINGS, readerTheme: 'dark' })
    const shadow = getShadow()!
    const darkDot = shadow.querySelector('[data-theme="dark"]')
    const lightDot = shadow.querySelector('[data-theme="light"]')
    expect(darkDot?.getAttribute('aria-pressed')).toBe('true')
    expect(lightDot?.getAttribute('aria-pressed')).toBe('false')
  })

  // ── Header controls ────────────────────────────────────────────────────────

  it('font select change calls setSettings with new font', async () => {
    await reader.open()
    const shadow = getShadow()!
    const select = shadow.getElementById('cp-font-select') as HTMLSelectElement
    select.value = 'serif'
    select.dispatchEvent(new Event('change'))
    await new Promise((r) => setTimeout(r, 0))
    expect(mockSetSettings).toHaveBeenCalledWith({ readerFont: 'serif' })
  })

  it('A− button decreases font size', async () => {
    mockGetSettings.mockResolvedValue({ ...BASE_SETTINGS, readerFontSize: 18 })
    await reader.open()
    // After clicking, getSettings is called again — mock the updated value
    mockGetSettings.mockResolvedValue({ ...BASE_SETTINGS, readerFontSize: 16 })
    const shadow = getShadow()!
    const decBtn = shadow.getElementById('cp-size-dec') as HTMLButtonElement
    decBtn.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(mockSetSettings).toHaveBeenCalledWith({ readerFontSize: 16 })
  })

  it('A+ button increases font size', async () => {
    mockGetSettings.mockResolvedValue({ ...BASE_SETTINGS, readerFontSize: 18 })
    await reader.open()
    mockGetSettings.mockResolvedValue({ ...BASE_SETTINGS, readerFontSize: 20 })
    const shadow = getShadow()!
    const incBtn = shadow.getElementById('cp-size-inc') as HTMLButtonElement
    incBtn.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(mockSetSettings).toHaveBeenCalledWith({ readerFontSize: 20 })
  })

  it('A− button does nothing when already at minimum size (16px)', async () => {
    mockGetSettings.mockResolvedValue({ ...BASE_SETTINGS, readerFontSize: 16 })
    await reader.open()
    const shadow = getShadow()!
    const decBtn = shadow.getElementById('cp-size-dec') as HTMLButtonElement
    decBtn.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(mockSetSettings).not.toHaveBeenCalled()
  })

  it('A+ button does nothing when already at maximum size (24px)', async () => {
    mockGetSettings.mockResolvedValue({ ...BASE_SETTINGS, readerFontSize: 24 })
    await reader.open()
    const shadow = getShadow()!
    const incBtn = shadow.getElementById('cp-size-inc') as HTMLButtonElement
    incBtn.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(mockSetSettings).not.toHaveBeenCalled()
  })

  it('width button click calls setSettings with new column width', async () => {
    await reader.open()
    mockGetSettings.mockResolvedValue({ ...BASE_SETTINGS, readerColumnWidth: 'wide' })
    const shadow = getShadow()!
    const wideBtn = shadow.querySelector('[data-width="wide"]') as HTMLButtonElement
    wideBtn.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(mockSetSettings).toHaveBeenCalledWith({ readerColumnWidth: 'wide' })
  })

  it('theme dot click calls setSettings with new theme', async () => {
    await reader.open()
    mockGetSettings.mockResolvedValue({ ...BASE_SETTINGS, readerTheme: 'dark' })
    const shadow = getShadow()!
    const darkDot = shadow.querySelector('[data-theme="dark"]') as HTMLButtonElement
    darkDot.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(mockSetSettings).toHaveBeenCalledWith({ readerTheme: 'dark' })
  })

  it('close button in header closes the reader', async () => {
    await reader.open()
    expect(reader.isOpen()).toBe(true)
    const shadow = getShadow()!
    const closeBtn = shadow.getElementById('cp-reader-close') as HTMLButtonElement
    closeBtn.click()
    expect(reader.isOpen()).toBe(false)
  })
})
