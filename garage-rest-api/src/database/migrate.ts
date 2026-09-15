import 'dotenv/config';
import { createDatabase, requireDatabaseUrl } from './database.client.js';
import { migrateToLatest } from './migrator.js';

async function runMigrations(): Promise<void> {
  const db = createDatabase(requireDatabaseUrl());

  try {
    const results = await migrateToLatest(db);

    for (const result of results) {
      console.log(`${result.status}: ${result.migrationName}`);
    }

    if (!results.length) {
      console.log('No pending migrations');
    }
  } finally {
    await db.destroy();
  }
}

try {
  await runMigrations();
} catch (error) {
  console.error('Migration failed', error);
  process.exitCode = 1;
}
