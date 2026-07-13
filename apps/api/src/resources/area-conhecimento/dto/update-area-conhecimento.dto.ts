import { CreateAreaConhecimentoDto } from "./create-area-conhecimento.dto";
import { PartialType} from "@nestjs/mapped-types"


export class UpdateAreaConhecimentoDto extends PartialType(CreateAreaConhecimentoDto){};