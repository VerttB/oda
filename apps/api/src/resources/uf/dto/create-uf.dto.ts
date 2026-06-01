import {
  IsNotEmpty,
  IsString,

} from 'class-validator';
export class CreateUfDto {
  @IsNotEmpty()
  @IsString()
  sigla!: string;

  @IsNotEmpty()
  @IsString()
  nome!: string;
}
