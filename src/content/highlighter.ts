// Word-level highlighting during TTS playback in Reading Mode.
// attach() is called when reading mode is active and TTS is about to start.
// Words in the reader DOM are wrapped in <span class="cp-word"> elements;
// onWordBoundary() highlights the current word using a binary search over
// pre-computed character positions derived from the spoken text string.

let wordSpans: HTMLSpanElement[] = []
// Start position of each word in the spoken text (parallel array to wordSpans)
let wordPositions: number[] = []
let activeEl: HTMLSpanElement | null = null
let attachedContainer: Element | null = null

export function init(): void {
  wordSpans = []
  wordPositions = []
  activeEl = null
}

// Attach to a container for word-level highlighting.
// container: the DOM element whose text nodes will have words wrapped in spans.
// spokenText: the exact string that will be passed to TTS — used to compute
//   character-offset positions that match the charIndex values from onWordBoundary.
export function attach(container: Element, spokenText: string): void {
  detach()
  attachedContainer = container
  console.debug('[ClearPath] Highlighter: attaching to container — spoken chars:', spokenText.length)

  // Pre-compute start positions of each word in spokenText
  const posRegex = /\S+/g
  let m: RegExpExecArray | null
  while ((m = posRegex.exec(spokenText)) !== null) {
    wordPositions.push(m.index)
  }

  // Walk all text nodes inside container and wrap each word in a span
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text)
  }

  for (const textNode of textNodes) {
    /* v8 ignore next -- textContent is never null on a Text node */
    const text = textNode.textContent ?? ''
    if (!text.trim()) continue

    const frag = document.createDocumentFragment()
    const wordRegex = /(\S+)/g
    let lastIdx = 0
    let wm: RegExpExecArray | null

    while ((wm = wordRegex.exec(text)) !== null) {
      // Preserve whitespace before the word
      if (wm.index > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, wm.index)))
      }
      const span = document.createElement('span')
      span.className = 'cp-word'
      span.textContent = wm[0]
      wordSpans.push(span)
      frag.appendChild(span)
      lastIdx = wm.index + wm[0].length
    }

    // Preserve any trailing whitespace
    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)))
    }

    textNode.replaceWith(frag)
  }
}

// Called on each word boundary event from TTS.
// charIndex is the character offset within the spoken text string where the
// current word starts. We binary-search wordPositions to find the matching span.
export function onWordBoundary(charIndex: number, _text: string): void {
  if (wordSpans.length === 0) return

  // Binary search: find largest wordPositions[i] <= charIndex
  let lo = 0
  let hi = wordPositions.length - 1
  let idx = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (wordPositions[mid] <= charIndex) {
      idx = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  const next = wordSpans[idx]
  if (next === activeEl) return

  activeEl?.classList.remove('cp-active')
  /* v8 ignore next -- wordSpans[idx] is always defined within bounds */
  activeEl = next ?? null
  activeEl?.classList.add('cp-active')
  /* v8 ignore next -- scrollIntoView not implemented in jsdom */
  activeEl?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
}

// Remove the active word highlight without unwrapping spans.
// Called when TTS transitions to idle.
export function clear(): void {
  activeEl?.classList.remove('cp-active')
  activeEl = null
}

// Remove all word spans and reset state.
// Called when reading mode closes, or before a new attach().
export function detach(): void {
  if (attachedContainer) {
    console.debug('[ClearPath] Highlighter: detaching — removing', wordSpans.length, 'word spans')
  }
  // Unwrap any existing word spans back to plain text nodes
  if (attachedContainer) {
    attachedContainer.querySelectorAll('.cp-word').forEach((span) => {
      /* v8 ignore next -- textContent is never null on an Element */
      span.replaceWith(document.createTextNode(span.textContent ?? ''))
    })
  }
  attachedContainer = null
  wordSpans = []
  wordPositions = []
  activeEl = null
}
