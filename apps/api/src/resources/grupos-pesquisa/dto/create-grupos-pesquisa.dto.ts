import { Situacao } from '@/prisma/prisma.enums';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGruposPesquisaDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dgpId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  nome: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  anoFormacao?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  areaPredominante: string;

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
  instituicaoId: string;
}
