import { Module } from '@nestjs/common';
import { CarsModule } from './cars/cars.module.js';
import { DatabaseModule } from './database/database.module.js';
import { StockModule } from './stock/stock.module.js';

@Module({
  imports: [CarsModule, DatabaseModule, StockModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
