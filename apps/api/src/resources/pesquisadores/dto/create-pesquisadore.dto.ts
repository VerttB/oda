import { FormacaoAcademica, TipoPesquisador } from '@/prisma/prisma.enums';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePesquisadoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lattesId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  nome: string;

  @IsOptional()
  @IsEnum(TipoPesquisador)
  tipo?: TipoPesquisador;

  @IsOptional()
  @IsEnum(FormacaoAcademica)
  formacaoAcademica?: FormacaoAcademica;
}
