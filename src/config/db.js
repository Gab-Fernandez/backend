import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

console.log(`[Database] Connecting to SQLite/Turso at: ${url}`);

export const dbClient = createClient({
  url,
  authToken,
});

/**
 * Helper to run simple SQL execution with arguments.
 * Logs query in development.
 */
export async function execute(sql, args = []) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SQL Query] ${sql} | Args: ${JSON.stringify(args)}`);
    }
    return await dbClient.execute({ sql, args });
  } catch (error) {
    console.error(`[SQL Error] Failed to execute: "${sql}"`, error);
    throw error;
  }
}

/**
 * Helper to execute multiple queries as a transaction batch.
 */
export async function batch(statements) {
  try {
    return await dbClient.batch(statements);
  } catch (error) {
    console.error(`[SQL Batch Error] Failed to execute batch`, error);
    throw error;
  }
}
