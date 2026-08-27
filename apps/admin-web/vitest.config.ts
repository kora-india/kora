import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // next-auth's ESM build imports "next/server" without an extension, which
    // Vite's strict ESM resolver can't find (Next.js's own bundler resolves it
    // implicitly). Point it at the real file so packages that import next-auth
    // directly (e.g. @schoolos/auth) can be loaded in tests.
    alias: {
      'next/server': 'next/server.js',
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    server: {
      // Force next-auth through Vite's own resolver (instead of being
      // externalized to Node's native ESM loader) so the `next/server` alias
      // above actually applies to it.
      deps: { inline: ['next-auth'] },
    },
  },
});
