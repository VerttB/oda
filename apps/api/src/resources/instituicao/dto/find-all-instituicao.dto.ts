import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class FindAllInstituicaoDto extends PaginationDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsUUID()
  estadoId?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @Matches(/^[A-Z]{2}$/, { message: 'uf deve conter uma sigla de duas letras.' })
  uf?: string;
}
