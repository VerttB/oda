import { PartialType } from '@nestjs/mapped-types';
import { CreateProducoeDto } from './create-producoe.dto';

export class UpdateProducoeDto extends PartialType(CreateProducoeDto) {}
