import { sql } from 'kysely';
import { requireTestDatabaseUrl, TEST_DATABASE_NAME } from './test-env.js';
import { migrateToLatest } from '../../src/database/migrator.js';
import { createDatabase } from '../../src/database/database.client.js';

export default async function setup() {
  const connectionString = requireTestDatabaseUrl();
  const adminUrl = new URL(connectionString);
  adminUrl.pathname = '/postgres';

  const admin = createDatabase(adminUrl.toString());
  try {
    const { rows } =
      await sql`select 1 from pg_database where datname = ${TEST_DATABASE_NAME}`.execute(
        admin,
      );

    if (rows.length === 0) {
      await sql`create database ${sql.id(TEST_DATABASE_NAME)}`.execute(admin);
    }
  } finally {
    await admin.destroy();
  }

  const db = createDatabase(connectionString);
  try {
    await migrateToLatest(db);
  } finally {
    await db.destroy();
  }
}
