import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: { port: 5173, host: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Vendor code in its own chunks: a Verdex deploy does not make returning visitors re-download React, MUI or viem.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react'
          if (/node_modules\/(@mui|@emotion)\//.test(id)) return 'vendor-mui'
          if (/node_modules\/(viem|ox|abitype|@noble|@scure|isows|ws)\//.test(id)) return 'vendor-viem'
          if (/node_modules\/motion/.test(id)) return 'vendor-motion'
          return undefined
        },
      },
    },
  },
})
