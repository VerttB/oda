import { IsNotEmpty, IsString } from "class-validator";
import { PalavraChave } from "@oda/database";

export class CreatePalavraChaveDto{
    @IsString()
    @IsNotEmpty()
    termo!: string
 
}