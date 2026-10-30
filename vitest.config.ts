import { defineConfig } from 'vitest/config'
import manifest from './manifest.json'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(manifest.version),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      exclude: [
        // Build-tool configs — not application code
        '.eslintrc.cjs',
        'postcss.config.cjs',
        'tailwind.config.ts',
        // React DOM entry point — not unit-testable
        'src/popup/index.tsx',
      ],
    },
  },
})
