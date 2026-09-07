import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  type CreateLinhaPesquisaRequest,
  CreateLinhaPesquisaRequestSchema,
  type UpdateLinhaPesquisaRequest,
  UpdateLinhaPesquisaRequestSchema,
} from '@oda/shared-types';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { LinhaPesquisaService } from './linha-pesquisa.service';
import { FindAllLinhaPesquisaDto } from './dto/find-all-linha-pesquisa.dto';

@Controller('linha-pesquisa')
export class LinhaPesquisaController {
  constructor(private readonly linhaPesquisaService: LinhaPesquisaService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateLinhaPesquisaRequestSchema))
    createLinhaPesquisaDto: CreateLinhaPesquisaRequest,
  ) {
    return this.linhaPesquisaService.create(createLinhaPesquisaDto);
  }

  @Get()
  findAll(@Query() query: FindAllLinhaPesquisaDto) {
    return this.linhaPesquisaService.findAll(query);
  }

  @Get('busca-semantica')
  buscaSemantica(
    @Query('q') query: string, 
    @Query('page') page?: number, 
    @Query('size') size?: number
  ) {
    return this.linhaPesquisaService.buscaSemantica(query, page, size);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.linhaPesquisaService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateLinhaPesquisaRequestSchema))
    updateLinhaPesquisaDto: UpdateLinhaPesquisaRequest,
  ) {
    return this.linhaPesquisaService.update(id, updateLinhaPesquisaDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.linhaPesquisaService.remove(id);
  }
}
