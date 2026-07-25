import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // L'applicazione ragiona in ora italiana e diversi bug corretti erano di
    // fuso orario: la suite va eseguita sempre nello stesso fuso, altrimenti
    // passerebbe o fallirebbe a seconda della macchina.
    env: { TZ: 'Europe/Rome' },
  },
})
