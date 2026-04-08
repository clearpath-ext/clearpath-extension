// Reading ruler — a semi-transparent horizontal band that follows the mouse cursor,
// helping users track which line they are reading.
// Rendered as a pointer-events:none Shadow DOM overlay attached to document.body.

let host: HTMLElement | null = null
let band: HTMLElement | null = null
let enabled = false
let color = '#FFD700'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildCSS(): string {
  return `
    :host {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      pointer-events: none;
    }
    .cp-ruler-band {
      position: absolute;
      left: 0;
      width: 100%;
      height: 28px;
      opacity: 0.3;
      border-radius: 2px;
      transition: top 0.04s linear;
    }
  `
}

function onMouseMove(e: MouseEvent): void {
  /* v8 ignore next -- band is always set when this listener is active */
  if (!band) return
  band.style.top = `${e.clientY - 14}px`
}

// ── Public API ────────────────────────────────────────────────────────────────

export function init(): void {
  console.debug('[ClearPath] Ruler: init')
  if (host) {
    host.remove()
    host = null
    band = null
  }
  enabled = false
  color = '#FFD700'
}

export function setEnabled(value: boolean): void {
  console.debug('[ClearPath] Ruler: setEnabled —', value)
  enabled = value

  if (enabled) {
    if (!host) {
      host = document.createElement('div')
      host.setAttribute('aria-hidden', 'true')
      const shadow = host.attachShadow({ mode: 'open' })

      const style = document.createElement('style')
      style.textContent = buildCSS()
      shadow.appendChild(style)

      band = document.createElement('div')
      band.className = 'cp-ruler-band'
      band.style.background = color
      band.style.top = '-100px'
      shadow.appendChild(band)

      document.body.appendChild(host)
    }
    document.addEventListener('mousemove', onMouseMove)
  } else {
    document.removeEventListener('mousemove', onMouseMove)
    if (host) {
      host.remove()
      host = null
      band = null
    }
  }
}

export function setColor(newColor: string): void {
  console.debug('[ClearPath] Ruler: setColor —', newColor)
  color = newColor
  if (band) band.style.background = newColor
}

export function isEnabled(): boolean {
  return enabled
}
