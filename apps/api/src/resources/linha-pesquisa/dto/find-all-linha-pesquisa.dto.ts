import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class FindAllLinhaPesquisaDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  grupo?: string;

  @IsOptional()
  @IsString()
  nome?: string;
}
