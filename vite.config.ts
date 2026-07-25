import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  // Percorsi relativi: gli asset si risolvono anche quando l'app è servita da
  // una sottocartella (anteprime, GitHub Pages), dove `/assets/…` darebbe 404.
  base: process.env.VITE_BASE ?? './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // I grafici e il router pesano più del resto: separarli evita di
    // riscaricare tutto a ogni modifica dell'applicazione.
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'grafici', test: /node_modules[\\/](recharts|d3-|victory)/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router)/ },
          ],
        },
      },
    },
  },
})
