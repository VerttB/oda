import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

type ZodValidationResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        issues: unknown[];
      };
    };

type ZodLikeSchema<T> = {
  safeParse(value: unknown): ZodValidationResult<T>;
};

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodLikeSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues,
      });
    }

    return result.data;
  }
}
