import { TipoProducao } from '@/prisma/prisma.enums';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CreateProducaoAutorDto {
  @IsUUID()
  pesquisadorId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ordemAutoria?: number;
}

export class CreateProducoeDto {
  @IsString()
  titulo!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ano?: number;

  @IsOptional()
  @IsEnum(TipoProducao)
  tipo?: TipoProducao;

  @IsOptional()
  @IsString()
  doi?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  veiculo?: string;

  @IsOptional()
  @IsString()
  resumo?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique((autor: CreateProducaoAutorDto) => autor.pesquisadorId)
  @ValidateNested({ each: true })
  @Type(() => CreateProducaoAutorDto)
  autores?: CreateProducaoAutorDto[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayUnique()
  palavraChaveIds?: string[];
}
