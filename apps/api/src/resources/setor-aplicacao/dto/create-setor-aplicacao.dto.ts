import { IsNotEmpty, IsString } from "class-validator";
import { SetorAplicacao } from "@oda/database";
export class CreateSetorAplicacaoDto{
    @IsString()
    @IsNotEmpty()
    nome!: string
    
    @IsString()
    @IsNotEmpty()
    nomeNormalizado!:string
}
