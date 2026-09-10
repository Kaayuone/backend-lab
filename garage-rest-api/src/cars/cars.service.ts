import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCarDto } from './dto/create-car.dto.js';
import { UpdateCarDto } from './dto/update-car.dto.js';
import { CARS_REPOSITORY } from './repositories/cars.repository.js';
import type { CarsRepository } from './repositories/cars.repository.js';
import {
  toCarResponse,
  toCarResponseList,
  toCreateCarInput,
  toUpdateCarInput,
} from './cars.mapper.js';
import type { CarResponseDto } from './dto/car-response.dto.js';

@Injectable()
export class CarsService {
  constructor(
    @Inject(CARS_REPOSITORY)
    private readonly carsRepository: CarsRepository,
  ) {}

  async create(createCarDto: CreateCarDto) {
    const id = await this.carsRepository.create(toCreateCarInput(createCarDto));
    return { id };
  }

  async findAll(): Promise<CarResponseDto[]> {
    const cars = await this.carsRepository.findAll();
    return toCarResponseList(cars);
  }

  async findOne(id: string): Promise<CarResponseDto> {
    const car = await this.carsRepository.findById(id);
    if (!car) {
      throw new NotFoundException(`Car ${id} not found`);
    }
    return toCarResponse(car);
  }

  async update(
    id: string,
    updateCarDto: UpdateCarDto,
  ): Promise<CarResponseDto> {
    const input = toUpdateCarInput(updateCarDto);

    if (input.name === undefined && input.mileage === undefined) {
      throw new BadRequestException('At least one field must be provided');
    }

    const car = await this.carsRepository.update(id, input);
    if (!car) {
      throw new NotFoundException(`Car ${id} not found`);
    }
    return toCarResponse(car);
  }

  async remove(id: string) {
    const deleted = await this.carsRepository.delete(id);

    if (!deleted) {
      throw new NotFoundException(`Car ${id} not found`);
    }
  }
}
