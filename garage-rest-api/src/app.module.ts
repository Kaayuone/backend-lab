import { Module } from '@nestjs/common';
import { CarsModule } from './cars/cars.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [CarsModule, DatabaseModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
