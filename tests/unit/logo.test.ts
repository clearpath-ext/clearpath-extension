import { describe, it, expect } from 'vitest'
import { createLogoIcon } from '../../src/shared/logo'

describe('createLogoIcon', () => {
  it('builds a decorative SVG at the requested size', () => {
    const svg = createLogoIcon(20)
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(svg.getAttribute('width')).toBe('20')
    expect(svg.getAttribute('height')).toBe('20')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.querySelector('rect')).not.toBeNull()
    expect(svg.querySelector('path')).not.toBeNull()
    expect(svg.querySelector('polyline')).not.toBeNull()
  })

  it('scopes gradient ids to the prefix so two icons on a page don\'t collide', () => {
    const svg = createLogoIcon(24, 'reader')
    const ids = [...svg.querySelectorAll('linearGradient')].map((g) => g.id)
    expect(ids).toEqual(['reader-bg', 'reader-g'])
    expect(svg.querySelector('rect')?.getAttribute('fill')).toBe('url(#reader-bg)')
    expect(svg.querySelector('path')?.getAttribute('stroke')).toBe('url(#reader-g)')
  })
})
