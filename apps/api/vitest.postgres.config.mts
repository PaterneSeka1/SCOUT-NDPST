import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// Suite explicite : jamais découverte par npm test, sans base synthétique dédiée.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/postgres-auth.integration.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
})
