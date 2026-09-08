import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';

export function omitAuditFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitAuditFields);
  if (!value || typeof value !== 'object') return value;
  // Preserva Date, Buffer e objetos com serializacao propria.
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'criadoEm' && key !== 'atualizadoEm')
    .map(([key, item]) => [key, omitAuditFields(item)]));
}

@Injectable()
export class OmitAuditFieldsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map(omitAuditFields));
  }
}
