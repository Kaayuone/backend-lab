import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CarsService } from './cars.service.js';
import { CreateCarDto } from './dto/create-car.dto.js';
import { UpdateCarDto } from './dto/update-car.dto.js';
import { CarIdParamsDto } from './dto/car-id-params.dto.js';

@Controller('cars')
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Post()
  create(@Body() createCarDto: CreateCarDto) {
    return this.carsService.create(createCarDto);
  }

  @Get()
  findAll() {
    return this.carsService.findAll();
  }

  @Get(':id')
  findOne(@Param() params: CarIdParamsDto) {
    return this.carsService.findOne(params.id);
  }

  @Patch(':id')
  update(@Param() params: CarIdParamsDto, @Body() updateCarDto: UpdateCarDto) {
    return this.carsService.update(params.id, updateCarDto);
  }

  @Delete(':id')
  remove(@Param() params: CarIdParamsDto) {
    return this.carsService.remove(params.id);
  }
}
