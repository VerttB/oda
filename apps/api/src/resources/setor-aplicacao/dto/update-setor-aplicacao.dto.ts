import { PartialType} from "@nestjs/mapped-types"
import { CreateSetorAplicacaoDto } from "./create-setor-aplicacao.dto";


export class UpdateSetorAplicacaoDto extends PartialType(CreateSetorAplicacaoDto){};