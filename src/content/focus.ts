// Paragraph focus — dims everything in the reading mode content area except the
// block element the user is currently hovering over.
// Only operates inside reading mode (attach/detach called by content/index.ts
// when the reader opens and closes).

let enabled = false
let attachedContainer: Element | null = null
let currentFocused: Element | null = null

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns the direct child of container that is an ancestor of (or equal to) target.
function getTopLevelBlock(target: Element, container: Element): Element | null {
  let el: Element | null = target
  while (el && el.parentElement !== container) {
    /* v8 ignore next -- parentElement is null only outside the document */
    if (!el.parentElement) return null
    el = el.parentElement
  }
  /* v8 ignore next -- el === container is unreachable; loop exits only when el is a direct child */
  return el === container ? null : el
}

function handleMouseover(e: Event): void {
  if (!enabled || !attachedContainer) return
  const target = e.target as Element
  const block = getTopLevelBlock(target, attachedContainer)
  if (!block || block === currentFocused) return

  currentFocused?.classList.remove('cp-focused')
  currentFocused = block
  currentFocused.classList.add('cp-focused')
  attachedContainer.classList.add('cp-focus-active')
}

// ── Public API ────────────────────────────────────────────────────────────────

export function init(): void {
  console.debug('[ClearPath] Focus: init')
  enabled = false
  attachedContainer = null
  currentFocused = null
}

// Called when the reader opens. Registers the mouseover listener on the
// article content element.
export function attach(contentEl: Element): void {
  detach()
  console.debug('[ClearPath] Focus: attaching to content element')
  attachedContainer = contentEl
  contentEl.addEventListener('mouseover', handleMouseover)
}

// Called when the reader closes. Removes the listener and cleans up classes.
export function detach(): void {
  if (attachedContainer) {
    console.debug('[ClearPath] Focus: detaching')
    attachedContainer.removeEventListener('mouseover', handleMouseover)
    attachedContainer.classList.remove('cp-focus-active')
    currentFocused?.classList.remove('cp-focused')
    attachedContainer = null
    currentFocused = null
  }
}

export function setEnabled(value: boolean): void {
  console.debug('[ClearPath] Focus: setEnabled —', value)
  enabled = value
  if (!enabled && attachedContainer) {
    attachedContainer.classList.remove('cp-focus-active')
    currentFocused?.classList.remove('cp-focused')
    currentFocused = null
  }
}

export function isEnabled(): boolean {
  return enabled
}
