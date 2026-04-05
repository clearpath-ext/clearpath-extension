let host: HTMLElement | null = null
let shadow: ShadowRoot | null = null
let contentEl: HTMLElement | null = null

const CSS = `
  :host {
    all: initial;
    position: fixed;
    bottom: 80px;
    right: 16px;
    z-index: 2147483647;
    width: 360px;
    max-width: calc(100vw - 32px);
  }

  .panel {
    background: #0D1F3C;
    border: 1px solid rgba(91, 155, 248, 0.25);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    font-family: system-ui, -apple-system, sans-serif;
    max-height: 400px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }

  .title {
    font-size: 11px;
    font-weight: 600;
    color: #5B9BF8;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    user-select: none;
  }

  .close {
    background: transparent;
    border: none;
    cursor: pointer;
    color: #94a3b8;
    font-size: 18px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .close:hover { color: #e2e8f0; }

  .content {
    overflow-y: auto;
    max-height: 320px;
    flex: 1;
  }

  .spinner-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #94a3b8;
    font-size: 13px;
  }

  @keyframes cp-spin { to { transform: rotate(360deg); } }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(91, 155, 248, 0.3);
    border-top-color: #5B9BF8;
    border-radius: 50%;
    animation: cp-spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  .result-text {
    color: #e2e8f0;
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0 0 12px;
  }

  .copy-btn {
    background: #5B9BF8;
    border: none;
    cursor: pointer;
    color: white;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 6px;
    transition: opacity 0.15s;
  }

  .copy-btn:hover { opacity: 0.85; }

  .error-text {
    color: #f87171;
    font-size: 13px;
    line-height: 1.5;
    margin: 0;
  }
`

export function init(): void {
  if (host) return

  host = document.createElement('div')
  host.id = 'clearpath-overlay-host'
  shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = CSS
  shadow.appendChild(style)

  const panel = document.createElement('div')
  panel.className = 'panel'

  const header = document.createElement('div')
  header.className = 'header'

  const title = document.createElement('span')
  title.className = 'title'
  title.textContent = 'Simplified'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'close'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', () => hide())

  header.appendChild(title)
  header.appendChild(closeBtn)

  contentEl = document.createElement('div')
  contentEl.className = 'content'

  panel.appendChild(header)
  panel.appendChild(contentEl)
  shadow.appendChild(panel)

  document.body.appendChild(host)
  host.style.display = 'none'
}

export function showLoading(): void {
  if (!host || !contentEl) return
  console.debug('[ClearPath] Overlay: showLoading')

  const wrap = document.createElement('div')
  wrap.className = 'spinner-wrap'

  const spinner = document.createElement('div')
  spinner.className = 'spinner'

  const label = document.createElement('span')
  label.textContent = 'Simplifying\u2026'

  wrap.appendChild(spinner)
  wrap.appendChild(label)

  contentEl.innerHTML = ''
  contentEl.appendChild(wrap)
  host.style.display = 'block'
}

export function showResult(text: string): void {
  if (!host || !contentEl) return
  console.debug('[ClearPath] Overlay: showResult —', text.length, 'chars')

  const p = document.createElement('p')
  p.className = 'result-text'
  p.textContent = text

  const btn = document.createElement('button')
  btn.className = 'copy-btn'
  btn.textContent = 'Copy'
  btn.addEventListener('click', () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        btn.textContent = 'Copied \u2713'
        setTimeout(() => {
          btn.textContent = 'Copy'
        }, 2000)
      })
      .catch(() => {})
  })

  contentEl.innerHTML = ''
  contentEl.appendChild(p)
  contentEl.appendChild(btn)
  host.style.display = 'block'
}

export function showError(msg: string): void {
  if (!host || !contentEl) return
  console.debug('[ClearPath] Overlay: showError —', msg)

  const p = document.createElement('p')
  p.className = 'error-text'
  p.textContent = msg

  contentEl.innerHTML = ''
  contentEl.appendChild(p)
  host.style.display = 'block'
}

export function hide(): void {
  if (!host) return
  host.style.display = 'none'
}

export function destroy(): void {
  host?.remove()
  host = null
  shadow = null
  contentEl = null
}
