import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PesquisadoresService } from './pesquisadores.service';
import { CreatePesquisadoreDto } from './dto/create-pesquisadore.dto';
import { UpdatePesquisadoreDto } from './dto/update-pesquisadore.dto';

@Controller('pesquisadores')
export class PesquisadoresController {
  constructor(private readonly pesquisadoresService: PesquisadoresService) {}

  @Post()
  create(@Body() createPesquisadoreDto: CreatePesquisadoreDto) {
    return this.pesquisadoresService.create(createPesquisadoreDto);
  }

  @Get()
  findAll() {
    return this.pesquisadoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pesquisadoresService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePesquisadoreDto: UpdatePesquisadoreDto,
  ) {
    return this.pesquisadoresService.update(id, updatePesquisadoreDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.pesquisadoresService.remove(id);
  }
}
