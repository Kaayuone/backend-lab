import {
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateCarDto {
  @IsNumberString({ no_symbols: true })
  userId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber()
  @Min(0)
  mileage?: number;
}
