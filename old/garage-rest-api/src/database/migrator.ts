import { Kysely } from 'kysely';
import { DB } from './database.types.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FileMigrationProvider, Migrator } from 'kysely/migration';

export function createMigrator(db: Kysely<DB>): Migrator {
  const migrationFolder = fileURLToPath(
    new URL('./migrations/', import.meta.url),
  );
  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
      import: (filePath) => import(pathToFileURL(filePath).href),
    }),
  });
}

export async function migrateToLatest(db: Kysely<DB>) {
  const { error, results } = await createMigrator(db).migrateToLatest();
  if (error) throw error;

  return results ?? [];
}
