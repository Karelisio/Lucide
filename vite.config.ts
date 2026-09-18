import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Le bundling par esbuild casse le glue code Emscripten de sql.js embarqué
    // dans jeep-sqlite (utilisé par @capacitor-community/sqlite sur le web).
    exclude: ['jeep-sqlite', '@capacitor-community/sqlite'],
  },
})
