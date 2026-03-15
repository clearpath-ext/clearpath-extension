import type { TTSState } from '../shared/types'

// Callbacks wired up by content/index.ts
type ToolbarCallbacks = {
  onPlayPause: () => void
  onStop: () => void
}

let host: HTMLElement | null = null
let shadow: ShadowRoot | null = null
let callbacks: ToolbarCallbacks | null = null

const CSS = `
  :host {
    all: initial;
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
  }

  .toolbar {
    background: #0D1F3C;
    border: 1px solid rgba(91, 155, 248, 0.25);
    border-radius: 12px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    font-family: system-ui, -apple-system, sans-serif;
  }

  .label {
    font-size: 11px;
    font-weight: 600;
    color: #5B9BF8;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-right: 4px;
    user-select: none;
  }

  .divider {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0 2px;
  }

  button {
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 8px;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #cbd5e1;
    transition: background 0.15s, color 0.15s;
    padding: 0;
  }

  button:hover {
    background: rgba(91, 155, 248, 0.15);
    color: #e2e8f0;
  }

  button:focus-visible {
    outline: 2px solid #5B9BF8;
    outline-offset: 2px;
  }

  button:active {
    background: rgba(91, 155, 248, 0.25);
  }
`

const ICON_PAUSE = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
  <rect x="2" y="1" width="4" height="12" rx="1"/>
  <rect x="8" y="1" width="4" height="12" rx="1"/>
</svg>`

const ICON_PLAY = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
  <path d="M3 1.5L12.5 7 3 12.5V1.5Z" stroke="currentColor" stroke-width="0.5"/>
</svg>`

const ICON_STOP = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
  <rect x="2" y="2" width="10" height="10" rx="1.5"/>
</svg>`

export function init(cbs: ToolbarCallbacks): void {
  if (host) return // already initialised — prevents duplicate hosts on re-init

  callbacks = cbs

  host = document.createElement('div')
  host.id = 'clearpath-toolbar-host'
  shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = CSS
  shadow.appendChild(style)

  const toolbar = document.createElement('div')
  toolbar.className = 'toolbar'
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', 'ClearPath Read Aloud controls')

  const label = document.createElement('span')
  label.className = 'label'
  label.textContent = 'Reading'

  const divider = document.createElement('div')
  divider.className = 'divider'

  const playPauseBtn = document.createElement('button')
  playPauseBtn.id = 'cp-playpause'
  playPauseBtn.setAttribute('aria-label', 'Pause')
  playPauseBtn.title = 'Pause'
  playPauseBtn.innerHTML = ICON_PAUSE
  playPauseBtn.addEventListener('click', () => callbacks?.onPlayPause())

  const stopBtn = document.createElement('button')
  stopBtn.id = 'cp-stop'
  stopBtn.setAttribute('aria-label', 'Stop reading')
  stopBtn.title = 'Stop'
  stopBtn.innerHTML = ICON_STOP
  stopBtn.addEventListener('click', () => callbacks?.onStop())

  toolbar.appendChild(label)
  toolbar.appendChild(divider)
  toolbar.appendChild(playPauseBtn)
  toolbar.appendChild(stopBtn)
  shadow.appendChild(toolbar)

  document.body.appendChild(host)
  host.style.display = 'none'
}

export function show(state: TTSState): void {
  if (!host) return
  host.style.display = 'block'
  updateState(state)
}

export function hide(): void {
  if (!host) return
  host.style.display = 'none'
}

export function destroy(): void {
  host?.remove()
  host = null
  shadow = null
  callbacks = null
}

export function updateState(state: TTSState): void {
  if (!shadow) return
  const btn = shadow.getElementById('cp-playpause') as HTMLButtonElement | null
  if (!btn) return

  if (state === 'playing') {
    btn.setAttribute('aria-label', 'Pause')
    btn.title = 'Pause'
    btn.innerHTML = ICON_PAUSE
  } else if (state === 'paused') {
    btn.setAttribute('aria-label', 'Resume reading')
    btn.title = 'Resume'
    btn.innerHTML = ICON_PLAY
  }
}
