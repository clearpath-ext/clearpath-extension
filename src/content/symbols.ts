// Symbol Overlay — places AAC pictogram images above matching words on any page.
// Works on the live DOM (not just in reading mode).
// Symbol PNGs live in public/symbols/ and are loaded via chrome.runtime.getURL().
// Sources: ARASAAC open symbol library (CC BY-NC-SA 4.0 — arasaac.org).

import { ALL_SYMBOL_MAP, KEY_SYMBOL_WORDS } from './symbolData'
import type { SymbolDensity } from '../shared/types'

const STYLE_ID = 'cp-symbol-styles'

let enabled = false
let density: SymbolDensity = 'key'
let attachedContainer: Element | null = null

// ── Helpers ───────────────────────────────────────────────────────────────────

function getActiveMap(): Readonly<Record<string, string>> {
  if (density === 'key') {
    const map: Record<string, string> = {}
    for (const word of KEY_SYMBOL_WORDS) {
      const filename = ALL_SYMBOL_MAP[word]
      if (filename) map[word] = filename
    }
    return map
  }
  return ALL_SYMBOL_MAP
}

function injectStyles(): void {
  /* v8 ignore next */
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = [
    '.cp-symbol-word{display:inline-flex;flex-direction:column;align-items:center;vertical-align:bottom;line-height:1;margin:0 1px;}',
    '.cp-symbol-img{display:block;width:40px;height:40px;object-fit:contain;}',
    '.cp-symbol-text{display:block;}',
  ].join('')
  document.head.appendChild(style)
}

function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove()
}

function wrapTextNode(textNode: Text, activeMap: Readonly<Record<string, string>>): void {
  /* v8 ignore next -- textContent is never null on a Text node */
  const text = textNode.textContent ?? ''
  /* v8 ignore next -- whitespace-only text nodes are skipped */
  if (!text.trim()) return

  const frag = document.createDocumentFragment()
  const wordRegex = /(\S+)/g
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = wordRegex.exec(text)) !== null) {
    const word = m[1]
    const lower = word.replace(/[^a-zA-Z]/g, '').toLowerCase()
    const filename = activeMap[lower]

    if (m.index > lastIdx) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)))
    }

    if (filename) {
      const wrapper = document.createElement('span')
      wrapper.className = 'cp-symbol-word'

      const img = document.createElement('img')
      img.className = 'cp-symbol-img'
      img.src = chrome.runtime.getURL(`symbols/${filename}.png`)
      img.alt = lower
      img.setAttribute('aria-hidden', 'true')

      const textSpan = document.createElement('span')
      textSpan.className = 'cp-symbol-text'
      textSpan.textContent = word

      wrapper.appendChild(img)
      wrapper.appendChild(textSpan)
      frag.appendChild(wrapper)
    } else {
      frag.appendChild(document.createTextNode(word))
    }

    lastIdx = m.index + word.length
  }

  if (lastIdx < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIdx)))
  }

  textNode.replaceWith(frag)
}

// ── Public API ────────────────────────────────────────────────────────────────

export function init(): void {
  console.debug('[ClearPath] Symbols: init')
  enabled = false
  density = 'key'
  attachedContainer = null
}

export function attach(containerEl: Element): void {
  detach()
  console.debug('[ClearPath] Symbols: attaching to element, density —', density)
  attachedContainer = containerEl
  injectStyles()

  const activeMap = getActiveMap()
  const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement
      /* v8 ignore next -- text nodes always have parentElement in a live document */
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName
      if (
        tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' ||
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      ) {
        return NodeFilter.FILTER_REJECT
      }
      /* v8 ignore next */
      if (parent.closest('.cp-symbol-word')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text)
  }

  let wrapped = 0
  for (const textNode of textNodes) {
    wrapTextNode(textNode, activeMap)
    wrapped++
  }
  console.debug('[ClearPath] Symbols: wrapped', wrapped, 'text nodes')
}

export function detach(): void {
  if (attachedContainer) {
    console.debug('[ClearPath] Symbols: detaching')
    attachedContainer.querySelectorAll('.cp-symbol-word').forEach((wrapper) => {
      /* v8 ignore next -- cp-symbol-text is always present inside cp-symbol-word */
      wrapper.replaceWith(document.createTextNode(wrapper.querySelector('.cp-symbol-text')?.textContent ?? ''))
    })
    attachedContainer = null
    removeStyles()
  }
}

export function setEnabled(value: boolean): void {
  console.debug('[ClearPath] Symbols: setEnabled —', value)
  enabled = value
}

export function setDensity(value: SymbolDensity): void {
  console.debug('[ClearPath] Symbols: setDensity —', value)
  density = value
}

export function isEnabled(): boolean {
  return enabled
}

export function getDensity(): SymbolDensity {
  return density
}
