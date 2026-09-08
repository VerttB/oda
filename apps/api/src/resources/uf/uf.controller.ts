import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { UfService } from './uf.service';
import { EstadoResponseDto } from './dto/response-uf.dto';

@ApiTags('uf')
@Controller('uf')
export class UfController {
  constructor(private readonly ufService: UfService) {}

  @Get()
  @ApiOperation({ summary: 'Lista unidades federativas' })
  @ZodResponse({ status: 200, type: [EstadoResponseDto] })
  findAll() {
    return this.ufService.findAll();
  }

}
