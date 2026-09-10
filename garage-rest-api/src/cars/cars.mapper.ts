import type { CreateCarDto } from './dto/create-car.dto.js';
import type {
  CreateCarInput,
  UpdateCarInput,
} from './repositories/cars.repository.js';
import type { UpdateCarDto } from './dto/update-car.dto.js';
import type { CarRow } from './entities/car.entity.js';
import type { CarResponseDto } from './dto/car-response.dto.js';

export function toCreateCarInput(createCarDto: CreateCarDto): CreateCarInput {
  return {
    user_id: createCarDto.userId,
    name: createCarDto.name,
    mileage: createCarDto.mileage,
  };
}

export function toUpdateCarInput(updateCarDto: UpdateCarDto): UpdateCarInput {
  return {
    mileage: updateCarDto.mileage,
    name: updateCarDto.name,
  };
}

export function toCarResponse(car: CarRow): CarResponseDto {
  return {
    id: car.id,
    userId: car.user_id,
    createdAt: car.created_at,
    name: car.name,
    mileage: Number(car.mileage),
  };
}

export function toCarResponseList(cars: readonly CarRow[]): CarResponseDto[] {
  return cars.map(toCarResponse);
}
