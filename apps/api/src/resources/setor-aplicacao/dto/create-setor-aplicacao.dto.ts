import { IsNotEmpty, IsString } from "class-validator";
import { SetorAplicacao } from "../../../../generated/prisma/client";
export class CreateSetorAplicacaoDto{
    @IsString()
    @IsNotEmpty()
    nome!: string
    
    @IsString()
    @IsNotEmpty()
    nomeNormalizado!:string
}
