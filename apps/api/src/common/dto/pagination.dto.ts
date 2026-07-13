import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  size: number = 30;

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.size ?? 30);
  }

  get take(): number | undefined {
    return this.size === 0 ? undefined : (this.size ?? 30);
  }
}
