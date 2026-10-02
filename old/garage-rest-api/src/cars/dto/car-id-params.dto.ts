import { Matches } from 'class-validator';

export class CarIdParamsDto {
  @Matches(/^[1-9]\d*$/)
  id: string;
}
