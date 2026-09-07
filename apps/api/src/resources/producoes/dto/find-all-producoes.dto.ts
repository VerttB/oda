import { IsEnum, IsOptional, IsString, IsInt, Matches } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { Qualis, TipoProducao } from '@oda/database';

export class FindAllProducoesDto extends PaginationDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  ano?: number;

  @IsOptional()
  @IsEnum(TipoProducao)
  tipo?: TipoProducao;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsEnum(Qualis)
  qualis?: Qualis;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @Matches(/^\d{4}-?\d{3}[\dX]$/, { message: 'issn deve ter o formato 12345678 ou 1234-5678 (ultimo digito pode ser X).' })
  issn?: string;

  @IsOptional()
  @IsString()
  pesquisadorId?: string;

  @IsOptional()
  @IsString()
  grupoId?: string;
}
