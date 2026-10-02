import { PartialType } from '@nestjs/mapped-types';
import { CreateStockDto } from './create-stock.dto.js';

export class UpdateStockDto extends PartialType(CreateStockDto) {}
