export class DatabaseConfigurationError extends Error {
  constructor(
    message = 'DATABASE_URL is required for Santa rulings persistence.',
  ) {
    super(message);
    this.name = 'DatabaseConfigurationError';
  }
}

export function getDatabaseUrl(): string {
  const databaseUrl = import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new DatabaseConfigurationError();
  }

  return databaseUrl;
}

export function isEndToEndTestMode(): boolean {
  return (
    import.meta.env.SANTA_TEST_MODE === 'e2e' ||
    process.env.SANTA_TEST_MODE === 'e2e'
  );
}
