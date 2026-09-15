import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../../database/database.types.js';
import {
  CarsRepository,
  CreateCarInput,
  UpdateCarInput,
} from './cars.repository.js';
import { KYSELY_DB } from '../../database/database.tokens.js';
import type { Kysely } from 'kysely';
import { CarRow } from '../entities/car.entity.js';

@Injectable()
export class KyselyCarsRepository implements CarsRepository {
  constructor(
    @Inject(KYSELY_DB)
    private readonly db: Kysely<DB>,
  ) {}

  async create(input: CreateCarInput): Promise<string> {
    const result = await this.db
      .insertInto('cars')
      .values(input)
      .returning('id')
      .executeTakeFirstOrThrow();

    return result.id;
  }

  findAll(): Promise<CarRow[]> {
    return this.db.selectFrom('cars').selectAll().execute();
  }

  findById(id: string): Promise<CarRow | undefined> {
    return this.db
      .selectFrom('cars')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  update(id: string, input: UpdateCarInput): Promise<CarRow | undefined> {
    return this.db
      .updateTable('cars')
      .set(input)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('cars')
      .where('id', '=', id)
      .executeTakeFirst();
    return result.numDeletedRows > 0n;
  }
}
