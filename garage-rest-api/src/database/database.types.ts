import type { ColumnType, GeneratedAlways } from 'kysely';

type CreatedAtColumn = ColumnType<
  Date, // SELECT
  Date | string | undefined, // INSERT
  never // UPDATE forbidden
>;

export interface UsersTable {
  id: GeneratedAlways<string>;

  created_at: CreatedAtColumn;

  username: string;
}

export interface CarsTable {
  id: GeneratedAlways<string>;
  user_id: string;

  created_at: CreatedAtColumn;

  name: string;

  mileage: ColumnType<
    string, // SELECT
    string | number | undefined, // INSERT
    string | number // UPDATE
  >;
}

export interface DB {
  users: UsersTable;
  cars: CarsTable;
}
