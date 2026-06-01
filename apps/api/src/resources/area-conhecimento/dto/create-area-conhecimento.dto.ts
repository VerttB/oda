import { IsNotEmpty, IsString } from "class-validator";

export class CreateAreaConhecimentoDto{
    @IsString()
    @IsNotEmpty()
    nome!:string



}