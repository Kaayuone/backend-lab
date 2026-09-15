import 'dotenv/config';
import type { Kysely, Transaction } from 'kysely';
import { createDatabase, requireDatabaseUrl } from './database.client.js';
import type { DB } from './database.types.js';

const seedCars = [
  { name: 'Toyota Camry', mileage: '128450.00' },
  { name: 'Genesis G70', mileage: '123.00' },
] as const;

const seedStockItems = [
  { name: 'Моторное масло, 1 л', quantity: 4 },
  { name: 'Масляный фильтр', quantity: 0 },
  { name: 'Воздушный фильтр', quantity: 1 },
  { name: 'Свеча зажигания', quantity: 4 },
] as const;

interface SeedResult {
  users: number;
  cars: number;
  stockItems: number;
}

function assertSeedingAllowed(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed the database in production');
  }
}

async function seedUser(trx: Transaction<DB>): Promise<{
  id: string;
  inserted: boolean;
}> {
  const existingUser = await trx
    .selectFrom('users')
    .select('id')
    .where('username', '=', 'Kaayuone')
    .executeTakeFirst();

  if (existingUser) {
    return { id: existingUser.id, inserted: false };
  }

  const user = await trx
    .insertInto('users')
    .values({ username: 'Kaayuone' })
    .returning('id')
    .executeTakeFirstOrThrow();

  return { id: user.id, inserted: true };
}

async function seedCarsForUser(
  trx: Transaction<DB>,
  userId: string,
): Promise<number> {
  const existingCars = await trx
    .selectFrom('cars')
    .select('name')
    .where('user_id', '=', userId)
    .where(
      'name',
      'in',
      seedCars.map((car) => car.name),
    )
    .execute();
  const existingNames = new Set(existingCars.map((car) => car.name));
  const missingCars = seedCars.filter((car) => !existingNames.has(car.name));

  if (missingCars.length === 0) {
    return 0;
  }

  await trx
    .insertInto('cars')
    .values(missingCars.map((car) => ({ ...car, user_id: userId })))
    .execute();

  return missingCars.length;
}

async function seedStockItemsForUser(
  trx: Transaction<DB>,
  userId: string,
): Promise<number> {
  const existingItems = await trx
    .selectFrom('stock_items')
    .select('name')
    .where('user_id', '=', userId)
    .where(
      'name',
      'in',
      seedStockItems.map((item) => item.name),
    )
    .execute();
  const existingNames = new Set(existingItems.map((item) => item.name));
  const missingItems = seedStockItems.filter(
    (item) => !existingNames.has(item.name),
  );

  if (missingItems.length === 0) {
    return 0;
  }

  await trx
    .insertInto('stock_items')
    .values(missingItems.map((item) => ({ ...item, user_id: userId })))
    .execute();

  return missingItems.length;
}

async function seedDatabase(db: Kysely<DB>): Promise<SeedResult> {
  return db.transaction().execute(async (trx) => {
    const user = await seedUser(trx);
    const cars = await seedCarsForUser(trx, user.id);
    const stockItems = await seedStockItemsForUser(trx, user.id);

    return {
      users: user.inserted ? 1 : 0,
      cars,
      stockItems,
    };
  });
}

async function runSeed(): Promise<void> {
  assertSeedingAllowed();

  const db = createDatabase(requireDatabaseUrl());

  try {
    const result = await seedDatabase(db);
    console.log(
      `Seed completed: users +${result.users}, cars +${result.cars}, stock_items +${result.stockItems}`,
    );
  } finally {
    await db.destroy();
  }
}

try {
  await runSeed();
} catch (error) {
  console.error('Database seed failed', error);
  process.exitCode = 1;
}
