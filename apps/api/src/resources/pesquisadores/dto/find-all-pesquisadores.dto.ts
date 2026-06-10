import { FormacaoAcademica, TipoPesquisador } from '@/prisma/prisma.enums';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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
}
