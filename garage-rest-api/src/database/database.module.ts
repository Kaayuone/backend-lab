import { Module } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import type { DB } from './database.types.js';
import { KYSELY_DB } from './database.tokens.js';
import { createDatabase, requireDatabaseUrl } from './database.client.js';
import { DatabaseLifecycle } from './database.lifecycle.js';

const kyselyProvider = {
  provide: KYSELY_DB,
  useFactory: async (): Promise<Kysely<DB>> => {
    const db = createDatabase(requireDatabaseUrl());

    try {
      await sql`select 1`.execute(db);
      return db;
    } catch (error) {
      await db.destroy();
      throw error;
    }
  },
};

@Module({
  providers: [kyselyProvider, DatabaseLifecycle],
  exports: [KYSELY_DB],
})
export class DatabaseModule {}
