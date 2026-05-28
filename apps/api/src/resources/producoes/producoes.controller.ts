import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ProducoesService } from './producoes.service';
import { CreateProducoeDto } from './dto/create-producoe.dto';
import { UpdateProducoeDto } from './dto/update-producoe.dto';

@Controller('producoes')
export class ProducoesController {
  constructor(private readonly producoesService: ProducoesService) {}

  @Post()
  create(@Body() createProducoeDto: CreateProducoeDto) {
    return this.producoesService.create(createProducoeDto);
  }

  @Get()
  findAll() {
    return this.producoesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.producoesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProducoeDto: UpdateProducoeDto,
  ) {
    return this.producoesService.update(id, updateProducoeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.producoesService.remove(id);
  }
}
