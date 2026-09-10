import type { CarRow } from './entities/car.entity.js';
import { toCarResponse, toCarResponseList } from './cars.mapper.js';

describe('cars mapper', () => {
  const carRow: CarRow = {
    id: '42',
    user_id: '7',
    created_at: new Date('2026-09-10T12:00:00.000Z'),
    name: 'Toyota Camry',
    mileage: '125000.50',
  };

  it('maps a database row to an API response', () => {
    expect(toCarResponse(carRow)).toEqual({
      id: '42',
      userId: '7',
      createdAt: new Date('2026-09-10T12:00:00.000Z'),
      name: 'Toyota Camry',
      mileage: 125000.5,
    });
  });

  it('maps a list of database rows to API responses', () => {
    expect(toCarResponseList([carRow])).toEqual([toCarResponse(carRow)]);
  });
});
