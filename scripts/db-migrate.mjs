import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is required before running database migrations for Santa Commands It!',
  );
  process.exit(1);
}

const result = spawnSync('npx', ['drizzle-kit', 'migrate'], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
