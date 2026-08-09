import { FormacaoAcademica, TipoPesquisador } from '@/prisma/prisma.enums';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class FindAllPesquisadoresDto extends PaginationDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEnum(FormacaoAcademica)
  formacaoAcademica?: FormacaoAcademica;

  @IsOptional()
  @IsEnum(TipoPesquisador)
  tipo?: TipoPesquisador;

  @IsOptional()
  @IsString()
  lattesId?: string;

  @IsOptional()
  @IsString()
  orcidId?: string;

  @IsOptional()
  @IsString()
  grupoPesquisaId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  eLider?: boolean;
}
