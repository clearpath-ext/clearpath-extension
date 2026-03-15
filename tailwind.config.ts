import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0D1F3C',
          800: '#132847',
          700: '#1a3357',
        },
        brand: {
          blue: '#5B9BF8',
          green: '#34D399',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
