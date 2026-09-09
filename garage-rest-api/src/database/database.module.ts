import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { KYSELY_DB } from './database.tokens.js';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { DB } from './database.types.js';
import { Pool } from 'pg';

const kyselyProvider = {
  provide: KYSELY_DB,

  useFactory: async (): Promise<Kysely<DB>> => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }

    const db = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString }),
      }),
    });

    // Проверяем реальное подключение до запуска приложения.
    await sql`select 1`.execute(db);

    return db;
  },
};

@Module({
  providers: [DatabaseService, kyselyProvider],
  exports: [DatabaseService, KYSELY_DB],
})
export class DatabaseModule {}
