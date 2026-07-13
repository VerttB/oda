import { IsNotEmpty, IsString } from "class-validator";
import { PalavraChave } from "../../../../generated/prisma/client";

export class CreatePalavraChaveDto{
    @IsString()
    @IsNotEmpty()
    termo!: string
 
}