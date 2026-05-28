import { TipoProducao } from '@/prisma/prisma.enums';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateProducaoAutorDto {
  @IsUUID()
  pesquisadorId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ordemAutoria?: number;
}

export class CreateProducoeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  titulo: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1500)
  @Max(new Date().getFullYear())
  ano?: number;

  @IsOptional()
  @IsEnum(TipoProducao)
  tipo?: TipoProducao;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  doi?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  veiculo?: string;

  @IsOptional()
  @IsString()
  resumo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProducaoAutorDto)
  autores?: CreateProducaoAutorDto[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayUnique()
  palavraChaveIds?: string[];
}
