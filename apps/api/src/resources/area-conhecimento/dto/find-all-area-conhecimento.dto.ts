import { TipoAreaConhecimento } from '@oda/database';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class FindAllAreaConhecimentoDto extends PaginationDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEnum(TipoAreaConhecimento)
  tipo?: TipoAreaConhecimento;

  @IsOptional()
  @IsUUID()
  areaPaiId?: string;
}
