import { Insertable, Updateable } from 'kysely';
import { CarRow } from '../entities/car.entity.js';
import { CarsTable } from '../../database/database.types.js';

export type CreateCarInput = Insertable<CarsTable>;
export type UpdateCarInput = Updateable<CarsTable>;

export const CARS_REPOSITORY = Symbol('CARS_REPOSITORY');

export interface CarsRepository {
  create(input: CreateCarInput): Promise<string>;
  findAll(): Promise<CarRow[]>;
  findById(id: string): Promise<CarRow | undefined>;
  update(id: string, input: UpdateCarInput): Promise<CarRow | undefined>;
  delete(id: string): Promise<boolean>;
}
