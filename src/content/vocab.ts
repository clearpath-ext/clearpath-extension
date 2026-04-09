// Vocabulary Support — shows a plain-English definition tooltip when the user
// double-clicks any word. The dictionary is loaded lazily from the bundled
// dictionary.json (derived from Simple English Wiktionary, CC BY-SA) on first
// use so it does not impact page load time.

const TOOLTIP_HOST_ID = 'cp-vocab-tooltip-host'

let enabled = false
let dictionaryPromise: Promise<Record<string, string>> | null = null
let dblClickHandler: ((e: MouseEvent) => void) | null = null
let dismissKeyHandler: ((e: KeyboardEvent) => void) | null = null
let dismissClickHandler: ((e: MouseEvent) => void) | null = null

export function init(): void {
  console.debug('[ClearPath] Vocab: init')
  enabled = false
  dictionaryPromise = null
  detach()
}

// ---------------------------------------------------------------------------
// Dictionary loading
// ---------------------------------------------------------------------------

function loadDictionary(): Promise<Record<string, string>> {
  if (!dictionaryPromise) {
    const url = chrome.runtime.getURL('dictionary.json')
    dictionaryPromise = fetch(url)
      .then((r) => r.json() as Promise<Record<string, string>>)
      .then((d) => {
        console.debug(`[ClearPath] Vocab: loaded ${Object.keys(d).length} entries`)
        return d
      })
  }
  return dictionaryPromise
}

function lookupWord(raw: string, dict: Record<string, string>): string | null {
  // Strip leading/trailing punctuation, lowercase
  const word = raw.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, '').toLowerCase()
  return dict[word] ?? null
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function showTooltip(word: string, definition: string, clientX: number, clientY: number): void {
  hideTooltip()

  const host = document.createElement('div')
  host.id = TOOLTIP_HOST_ID
  host.style.cssText =
    'position:fixed;z-index:2147483647;left:0;top:0;pointer-events:none;'

  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = [
    '.tooltip{',
    'position:absolute;',
    'max-width:280px;',
    'background:#0D1F3C;',
    'color:#E2E8F0;',
    'border:1px solid rgba(91,155,248,0.4);',
    'border-radius:8px;',
    'padding:10px 14px;',
    'font:14px/1.5 system-ui,sans-serif;',
    'box-shadow:0 4px 20px rgba(0,0,0,0.5);',
    'pointer-events:auto;',
    '}',
    '.word{font-weight:700;color:#5B9BF8;margin-bottom:4px;font-size:13px;text-transform:lowercase;}',
    '.def{font-size:13px;line-height:1.55;}',
  ].join('')

  const tooltip = document.createElement('div')
  tooltip.className = 'tooltip'

  const wordEl = document.createElement('div')
  wordEl.className = 'word'
  wordEl.textContent = word.toLowerCase()

  const defEl = document.createElement('div')
  defEl.className = 'def'
  defEl.textContent = definition

  tooltip.appendChild(wordEl)
  tooltip.appendChild(defEl)
  shadow.appendChild(style)
  shadow.appendChild(tooltip)
  document.body.appendChild(host)

  // Position near cursor, adjust to stay within viewport
  const pad = 12
  let x = clientX + pad
  let y = clientY + pad

  // Measure after next paint so we know the tooltip dimensions
  requestAnimationFrame(() => {
    const rect = tooltip.getBoundingClientRect()
    /* v8 ignore next */
    if (x + rect.width > window.innerWidth - pad) x = clientX - rect.width - pad
    /* v8 ignore next */
    if (y + rect.height > window.innerHeight - pad) y = clientY - rect.height - pad
    tooltip.style.left = `${Math.max(pad, x)}px`
    tooltip.style.top = `${Math.max(pad, y)}px`
  })
}

function hideTooltip(): void {
  const existing = document.getElementById(TOOLTIP_HOST_ID)
  /* v8 ignore next */
  existing?.remove()
}

// ---------------------------------------------------------------------------
// Listeners
// ---------------------------------------------------------------------------

function attach(): void {
  if (dblClickHandler) return

  dblClickHandler = async (e: MouseEvent) => {
    const selection = window.getSelection()
    const raw = selection?.toString().trim() ?? ''
    if (!raw || raw.includes(' ')) return

    const dict = await loadDictionary()
    const def = lookupWord(raw, dict)
    if (!def) { hideTooltip(); return }

    showTooltip(raw, def, e.clientX, e.clientY)
  }

  dismissKeyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') hideTooltip()
  }

  dismissClickHandler = (e: MouseEvent) => {
    const host = document.getElementById(TOOLTIP_HOST_ID)
    // Clicks inside the shadow DOM are retargeted to the host — the contains()
    // check guards against hypothetical light-DOM children only.
    /* v8 ignore next */
    if (host && e.target !== host && !host.contains(e.target as Node)) hideTooltip()
  }

  document.addEventListener('dblclick', dblClickHandler)
  document.addEventListener('keydown', dismissKeyHandler)
  document.addEventListener('click', dismissClickHandler)
  console.debug('[ClearPath] Vocab: attached')
}

function detach(): void {
  if (dblClickHandler) {
    document.removeEventListener('dblclick', dblClickHandler)
    dblClickHandler = null
  }
  if (dismissKeyHandler) {
    document.removeEventListener('keydown', dismissKeyHandler)
    dismissKeyHandler = null
  }
  if (dismissClickHandler) {
    document.removeEventListener('click', dismissClickHandler)
    dismissClickHandler = null
  }
  hideTooltip()
  console.debug('[ClearPath] Vocab: detached')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function setEnabled(value: boolean): void {
  console.debug('[ClearPath] Vocab: setEnabled', value)
  enabled = value
  if (value) {
    attach()
  } else {
    detach()
  }
}

export function isEnabled(): boolean {
  return enabled
}
