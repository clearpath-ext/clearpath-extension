import { defineConfig } from 'vitest/config'

export default defineConfig({
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
