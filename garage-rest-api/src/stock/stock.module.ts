import { Module } from '@nestjs/common';
import { StockService } from './stock.service.js';
import { StockController } from './stock.controller.js';

@Module({
  controllers: [StockController],
  providers: [StockService],
})
export class StockModule {}
