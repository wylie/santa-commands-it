import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://example.com',
  build: {
    format: 'directory',
  },
  vite: {
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    },
  },
});
