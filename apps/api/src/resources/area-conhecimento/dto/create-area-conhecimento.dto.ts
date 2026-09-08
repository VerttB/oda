import { TipoAreaConhecimento } from '@oda/database';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateAreaConhecimentoDto{
    @IsString()
    @IsNotEmpty()
    nome!:string

    @IsOptional()
    @IsEnum(TipoAreaConhecimento)
    tipo?: TipoAreaConhecimento;

    @IsOptional()
    @IsUUID()
    areaPaiId?: string | null;
}
