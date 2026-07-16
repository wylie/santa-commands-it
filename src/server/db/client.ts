import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import { getDatabaseUrl } from '@/server/env';
import * as schema from '@/server/db/schema';

let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDatabase() {
  if (!database) {
    const client = neon(getDatabaseUrl());
    database = drizzle(client, { schema });
  }

  return database;
}
