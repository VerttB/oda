import { Situacao } from '@/prisma/prisma.enums';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateGruposPesquisaDto {
  @IsOptional()
  @IsString()
  dgpId?: string;

  @IsString()
  nome!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  anoFormacao?: number;

  @IsString()
  areaPredominante!: string;

  @IsOptional()
  @IsString()
  repercussao?: string;

  @IsOptional()
  @IsUUID()
  areaConhecimentoId?: string;

  @IsOptional()
  @IsEnum(Situacao)
  situacao?: Situacao;

  @IsUUID()
  instituicaoId!: string;
}
