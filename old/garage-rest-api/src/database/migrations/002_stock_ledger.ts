import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE stock_movements (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      stock_item_id BIGINT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      type TEXT NOT NULL CHECK (
        type IN ('purchase', 'installation', 'manual_out', 'return', 'disposal')
      ),
      delta INTEGER NOT NULL CHECK (delta <> 0)
    )
  `.execute(db);

  await sql`
    CREATE INDEX stock_movements_item_idx ON stock_movements(stock_item_id)
  `.execute(db);

  // One opening movement per item that had stock; an item at zero needs no row,
  // an empty ledger already sums to zero. Must run before the DROP below.
  await sql`
    INSERT INTO stock_movements (stock_item_id, type, delta)
    SELECT id, 'purchase', quantity FROM stock_items WHERE quantity > 0
  `.execute(db);

  await sql`ALTER TABLE stock_items DROP COLUMN quantity`.execute(db);

  // amount is NOT NULL in 001, so the paired "money always carries currency"
  // CHECK degenerates into NOT NULL: add nullable, backfill, then tighten.
  await sql`ALTER TABLE service_records ADD COLUMN currency TEXT`.execute(db);

  await sql`UPDATE service_records SET currency = 'RUB'`.execute(db);

  await sql`
    ALTER TABLE service_records ALTER COLUMN currency SET NOT NULL
  `.execute(db);
}
