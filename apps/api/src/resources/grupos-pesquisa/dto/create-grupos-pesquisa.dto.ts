import { Situacao } from '@/prisma/prisma.enums';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayNotEmpty,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { TipoRelacaoGrupoInstituicao } from '@oda/database';

export class CreateGrupoPesquisaInstituicaoDto {
  @IsUUID()
  instituicaoId!: string;

  @IsOptional()
  @IsEnum(TipoRelacaoGrupoInstituicao)
  tipoRelacao?: TipoRelacaoGrupoInstituicao;

  @IsOptional()
  @IsString()
  unidade?: string;
}

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
  @IsEnum(Situacao)
  situacao?: Situacao;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateGrupoPesquisaInstituicaoDto)
  instituicoes!: CreateGrupoPesquisaInstituicaoDto[];
}
