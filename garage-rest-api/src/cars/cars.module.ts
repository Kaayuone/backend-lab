import { Module } from '@nestjs/common';
import { CarsService } from './cars.service.js';
import { CarsController } from './cars.controller.js';
import { DatabaseModule } from '../database/database.module.js';
import { CARS_REPOSITORY } from './repositories/cars.repository.js';
import { KyselyCarsRepository } from './repositories/kysely-car.repository.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CarsController],
  providers: [
    CarsService,
    {
      provide: CARS_REPOSITORY,
      useClass: KyselyCarsRepository,
    },
  ],
})
export class CarsModule {}
