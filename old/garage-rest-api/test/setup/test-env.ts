export const TEST_DATABASE_NAME = 'garage_test';

export function requireTestDatabaseUrl() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'TEST_DATABASE_URL is not configured. Refusing to use the development database.',
    );
  }

  const url = new URL(connectionString);
  const databaseName = decodeURIComponent(url.pathname.slice(1));

  if (databaseName !== TEST_DATABASE_NAME) {
    throw new Error(
      `TEST_DATABASE_URL must point to garage_test, received: ${databaseName}`,
    );
  }

  return connectionString;
}
