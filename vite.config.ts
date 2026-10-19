import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { foldkit } from '@foldkit/vite-plugin'

export default defineConfig({
  base: '/opencode-luminacad/',
  plugins: [
    tailwindcss(),
    foldkit({
      // Windows cannot verify ownership of the relay registry directory, so
      // discovery is unavailable there. A fixed port plus the matching
      // FOLDKIT_DEVTOOLS_MCP_PORT environment variable is the documented
      // alternative for MCP clients.
      devToolsMcpPort: 9988,
    }),
  ],
  optimizeDeps: {
    entries: ['src/entry.ts'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    rolldownOptions: {
      output: {
        // Three.js is the bulk of the bundle and changes far less often than
        // the application code, so it gets its own long-lived chunk.
        advancedChunks: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'foldkit', test: /node_modules[\\/](foldkit|effect)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
})
