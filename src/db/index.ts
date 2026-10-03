import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

function determineSsl(urlStr: string | undefined): 'require' | false {
  if (!urlStr) return 'require';
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname;
    const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (isLoopback && process.env.TEST_ALLOW_INSECURE_TLS === 'true') {
      return false;
    }
  } catch {
    // Fail closed: enforce SSL if parsing fails
  }
  return 'require';
}

// Configure connection pool to handle concurrent requests
export const client = postgres(connectionString, {
    max: 10, // Maximum pool size
    idle_timeout: 20, // Close idle connections after 20 seconds
    connect_timeout: 10, // Connection timeout in seconds
    ssl: determineSsl(connectionString),
});

export const db = drizzle(client, { schema });
