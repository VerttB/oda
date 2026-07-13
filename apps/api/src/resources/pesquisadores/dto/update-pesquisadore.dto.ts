import { PartialType } from '@nestjs/mapped-types';
import { CreatePesquisadoreDto } from './create-pesquisadore.dto';

export class UpdatePesquisadoreDto extends PartialType(CreatePesquisadoreDto) {}
