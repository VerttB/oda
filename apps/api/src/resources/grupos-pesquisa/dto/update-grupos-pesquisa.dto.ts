import { PartialType } from '@nestjs/mapped-types';
import { CreateGruposPesquisaDto } from './create-grupos-pesquisa.dto';

export class UpdateGruposPesquisaDto extends PartialType(
  CreateGruposPesquisaDto,
) {}
