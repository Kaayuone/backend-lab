import { BadRequestException } from '@nestjs/common';
import { CarsService } from './cars.service.js';
import type { CarsRepository } from './repositories/cars.repository.js';

describe('CarsService.update', () => {
  it('rejects an empty update without touching the repository', async () => {
    const repository: CarsRepository = {
      create: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const service = new CarsService(repository);

    await expect(service.update('1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });
});
