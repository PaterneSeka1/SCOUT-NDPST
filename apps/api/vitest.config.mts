import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// SWC plutôt qu'esbuild : NestJS a besoin des métadonnées de décorateurs
// (emitDecoratorMetadata) pour l'injection de dépendances, qu'esbuild n'émet pas.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src/generated'],
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
})
