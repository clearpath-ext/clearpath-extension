import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      // Brand guide: clearpath-ext/.github → brand/README.md (matches clearpathext.com)
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      colors: {
        navy: {
          900: '#0D1F3C',
          800: '#112240',
          700: '#162D50',
        },
        brand: {
          blue: '#5B9BF8',
          green: '#6DD9A8',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
