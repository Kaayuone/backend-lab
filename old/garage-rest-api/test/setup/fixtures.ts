import { randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { testPool } from './db.js';

export interface UserFixture extends QueryResultRow {
  id: string;
  username: string;
}

export interface CarFixture extends QueryResultRow {
  id: string;
  user_id: string;
  name: string;
  mileage: string;
}

interface CarOptions {
  name?: string;
  mileage?: string;
}

export async function withUser(username = `e2e-${randomUUID()}`) {
  const { rows } = await testPool.query<UserFixture>(
    `INSERT INTO users (username)  VALUES ($1) RETURNING id, username`,
    [username],
  );

  if (!rows[0]) {
    throw new Error('User fixture insert returned no row');
  }
  return rows[0];
}

export async function withCar(
  userId: string,
  { name = 'Test car', mileage = '0.00' }: CarOptions = {},
) {
  const { rows } = await testPool.query<CarFixture>(
    `
    INSERT INTO cars (user_id, name, mileage) VALUES ($1, $2, $3) RETURNING *
    `,
    [userId, name, mileage],
  );

  if (!rows[0]) {
    throw new Error('Car fixture insert returned no row');
  }
  return rows[0];
}
