import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/adhesions-nationales.postgres.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
})
