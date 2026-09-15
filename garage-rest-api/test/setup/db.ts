import { Pool } from 'pg';
import { requireTestDatabaseUrl } from './test-env.js';

export const testPool = new Pool({
  connectionString: requireTestDatabaseUrl(),
  max: 10,
});

export async function truncateAll() {
  await testPool.query(`
    TRUNCATE TABLE
    users,
    cars,
    service_records,
    stock_items
    RESTART IDENTITY CASCADE
    `);
}

export async function closeTestDatabase() {
  await testPool.end();
}
