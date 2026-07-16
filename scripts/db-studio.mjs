import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is required before opening Drizzle Studio for Santa Commands It!',
  );
  process.exit(1);
}

const result = spawnSync('npx', ['drizzle-kit', 'studio'], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
