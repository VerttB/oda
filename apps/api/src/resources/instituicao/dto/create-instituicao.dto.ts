import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInstituicaoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  nome!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(30)
  sigla!: string;

  @IsOptional()
  @IsUUID()
  ufId?: string;
}
