import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLinhaPesquisaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  titulo: string;

  @IsOptional()
  @IsString()
  objetivo?: string;

  @IsUUID()
  grupoId: string;
}
