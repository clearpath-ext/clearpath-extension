import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  // Shown in the popup header; manifest.json is the one place the version lives
  define: {
    __APP_VERSION__: JSON.stringify(manifest.version),
  },
  build: {
    minify: false,
    sourcemap: mode !== 'production',
  },
}))
