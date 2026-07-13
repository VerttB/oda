import { CreatePalavraChaveDto } from "./create-palavra-chave.dto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdatePalavraChaveDto extends PartialType(CreatePalavraChaveDto){}