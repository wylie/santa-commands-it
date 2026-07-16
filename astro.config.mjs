import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: process.env.SITE_URL,
  output: 'server',
  adapter: vercel(),
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
