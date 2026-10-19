import { defineConfig } from 'vitest/config'
import stylex from '@stylexjs/unplugin'
import type { Plugin } from 'vite'

/**
 * The StyleX transform, without the dev-server wiring.
 *
 * The plugin's `configureServer` hook starts a 150ms interval that watches
 * the shared CSS store and is cleared on `httpServer.close`. A Vitest run
 * owns a Vite server whose `httpServer` never closes, so the interval keeps
 * the process alive after the tests finish. The transform itself is what the
 * tests need; the dev middleware is not.
 */
const stylexForTests = (): Plugin[] => {
  const plugins = stylex.vite({
    unstable_moduleResolution: {
      type: 'commonJS',
      rootDir: process.cwd(),
    },
  })

  const list = Array.isArray(plugins) ? plugins : [plugins]

  return list.map((plugin) => ({
    ...plugin,
    configureServer: undefined,
  })) as Plugin[]
}

export default defineConfig({
  plugins: stylexForTests(),
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'happy-dom',
    setupFiles: ['./src/vitest-setup.ts'],
    server: {
      deps: {
        inline: ['foldkit', '@foldkit/ui', '@foldkit/devtools'],
      },
    },
  },
})
