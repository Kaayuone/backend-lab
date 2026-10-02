import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/app.js';
import { closeTestDatabase, truncateAll } from './setup/db.js';
import { withCar, withUser } from './setup/fixtures.js';
import request from 'supertest';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await app?.close();
  await closeTestDatabase();
});

describe('POST /api/v1/cars', () => {
  it('creates a car that can be read back', async () => {
    const user = await withUser();

    const created = await request(app.getHttpServer())
      .post('/api/v1/cars')
      .send({
        userId: user.id,
        name: 'Honda Civic',
        mileage: 1000,
      })
      .expect(201);

    expect(created.body).toEqual({ id: expect.stringMatching(/^\d+$/) });

    const fetched = await request(app.getHttpServer())
      .get(`/api/v1/cars/${created.body.id}`)
      .expect(200);

    expect(fetched.body).toMatchObject({
      id: created.body.id,
      userId: user.id,
      name: 'Honda Civic',
      mileage: 1000,
    });
  });

  it('rejects a non-numeric mileage', async () => {
    const user = await withUser();

    await request(app.getHttpServer())
      .post('/api/v1/cars')
      .send({
        userId: user.id,
        name: 'Honda Civic',
        mileage: 'banana',
      })
      .expect(400);
  });
});

describe('GET /api/v1/cars/:id', () => {
  it('returns 404 for a missing car', async () => {
    await request(app.getHttpServer()).get('/api/v1/cars/999').expect(404);
  });
});

describe('PATCH /api/v1/cars/:id', () => {
  it('rejects an empty body', async () => {
    const user = await withUser();
    const car = await withCar(user.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/cars/${car.id}`)
      .send({})
      .expect(400);
  });

  it('rejects unknown fields and leaves the car unchanged', async () => {
    const user = await withUser();
    const car = await withCar(user.id, { name: 'Original' });

    await request(app.getHttpServer()).patch(`/api/v1/cars/${car.id}`).send({
      name: 'Renamed',
      userid: 2,
    });

    const fetched = await request(app.getHttpServer())
      .get(`/api/v1/cars/${car.id}`)
      .expect(200);

    expect(fetched.body).toMatchObject({ name: 'Original', userId: user.id });
  });
});
