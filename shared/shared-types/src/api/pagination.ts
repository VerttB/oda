import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(0).default(30),
});

export const PaginationMetaResponseSchema = z.object({
  page: z.number().int().min(1),
  size: z.number().int().min(0),
  totalItems: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export const createPaginatedResponseSchema = <TItem extends z.ZodTypeAny>(
  itemSchema: TItem,
) =>
  z.object({
    data: z.array(itemSchema),
    meta: PaginationMetaResponseSchema,
  });

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type PaginationMetaResponse = z.infer<typeof PaginationMetaResponseSchema>;
