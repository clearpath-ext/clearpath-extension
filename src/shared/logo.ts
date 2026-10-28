// The ClearPath icon (navy tile + C-path mark), built with DOM calls so it
// can be dropped into any page: no image request for the page's CSP to block,
// and no innerHTML for Trusted Types to reject. Master artwork:
// https://github.com/clearpath-ext/.github/tree/main/brand

const SVG_NS = 'http://www.w3.org/2000/svg'

function el(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

export function createLogoIcon(size: number, idPrefix = 'cp-logo'): SVGSVGElement {
  const svg = el('svg', { viewBox: '0 0 512 512', width: String(size), height: String(size), 'aria-hidden': 'true', focusable: 'false' }) as SVGSVGElement

  const defs = el('defs', {})
  const bg = el('linearGradient', { id: `${idPrefix}-bg`, x1: '0', y1: '0', x2: '1', y2: '1' })
  bg.append(el('stop', { offset: '0', 'stop-color': '#0D1F3C' }), el('stop', { offset: '1', 'stop-color': '#132B52' }))
  const g = el('linearGradient', { id: `${idPrefix}-g`, gradientUnits: 'userSpaceOnUse', x1: '120', y1: '400', x2: '380', y2: '110' })
  g.append(el('stop', { offset: '0', 'stop-color': '#5B9BF8' }), el('stop', { offset: '1', 'stop-color': '#6DD9A8' }))
  defs.append(bg, g)

  const mark = el('g', { transform: 'translate(29 0)' })
  mark.append(
    el('path', { d: 'M 334 154 A 136 136 0 1 0 334 358', fill: 'none', stroke: `url(#${idPrefix}-g)`, 'stroke-width': '56', 'stroke-linecap': 'round' }),
    el('circle', { cx: '334', cy: '358', r: '40', fill: '#5B9BF8' }),
    el('circle', { cx: '334', cy: '358', r: '16', fill: '#0D1F3C' }),
    el('polyline', { points: '292,206 352,256 292,306', fill: 'none', stroke: '#6DD9A8', 'stroke-width': '44', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
  )

  svg.append(defs, el('rect', { width: '512', height: '512', rx: '112', fill: `url(#${idPrefix}-bg)` }), mark)
  return svg
}
