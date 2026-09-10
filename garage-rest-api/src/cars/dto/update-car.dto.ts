import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateCarDto } from './create-car.dto.js';

export class UpdateCarDto extends PartialType(
  OmitType(CreateCarDto, ['userId'] as const),
  { skipNullProperties: false },
) {}
