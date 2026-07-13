import { Situacao } from '@/prisma/prisma.enums';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class FindAllGruposPesquisaDto extends PaginationDto {
  @IsOptional()
  @IsEnum(Situacao)
  situacao?: Situacao;

  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  anoFormacao?: number;

  @IsOptional()
  @IsUUID()
  instituicao?: string;

  @IsOptional()
  @IsUUID()
  uf?: string;
}
