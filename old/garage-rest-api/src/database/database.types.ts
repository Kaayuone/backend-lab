import type { ColumnType, GeneratedAlways } from 'kysely';

type CreatedAtColumn = ColumnType<
  Date, // SELECT
  Date | string | undefined, // INSERT
  never // UPDATE forbidden
>;

type NumericColumn = ColumnType<
  string, // SELECT
  string | number, // INSERT
  string | number // UPDATE
>;

type ServicedAtColumn = ColumnType<
  string, // SELECT
  string, // INSERT
  string // UPDATE
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

export interface ServiceRecordsTable {
  id: GeneratedAlways<string>;
  car_id: string;

  created_at: CreatedAtColumn;

  mileage: NumericColumn;
  amount: NumericColumn;
  currency: string;
  description: ColumnType<
    string | null,
    string | null | undefined,
    string | null
  >;
  serviced_at: ServicedAtColumn;
}

export interface StockItemsTable {
  id: GeneratedAlways<string>;
  user_id: string;

  created_at: CreatedAtColumn;

  name: string;
}

export type StockMovementType =
  'purchase' | 'installation' | 'manual_out' | 'return' | 'disposal';

export interface StockMovementsTable {
  id: GeneratedAlways<string>;
  stock_item_id: string;

  created_at: CreatedAtColumn;

  type: StockMovementType;
  delta: number;
}

export interface DB {
  users: UsersTable;
  cars: CarsTable;
  service_records: ServiceRecordsTable;
  stock_items: StockItemsTable;
  stock_movements: StockMovementsTable;
}
