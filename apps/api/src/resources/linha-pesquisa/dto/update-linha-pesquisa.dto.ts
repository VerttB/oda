import { PartialType } from '@nestjs/mapped-types';
import { CreateLinhaPesquisaDto } from './create-linha-pesquisa.dto';

export class UpdateLinhaPesquisaDto extends PartialType(
  CreateLinhaPesquisaDto,
) {}
