import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { DB } from './database.types.js';
import { KYSELY_DB } from './database.tokens.js';

@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(KYSELY_DB)
    private readonly db: Kysely<DB>,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.destroy();
  }
}
