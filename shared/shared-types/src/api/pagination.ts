import { z } from 'zod';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 30;

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  size: z.coerce.number().int().min(0).default(DEFAULT_PAGE_SIZE),
});

export const SortOrderSchema = z.enum(['asc', 'desc']);
export const SearchModeSchema = z.enum(['textual', 'semantica']);
export const SemanticSearchQueryFields = {
  q: z.string().trim().min(1).max(500).optional(),
  modoBusca: SearchModeSchema.optional(),
};

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
export type SortOrder = z.infer<typeof SortOrderSchema>;
export type PaginationMetaResponse = z.infer<typeof PaginationMetaResponseSchema>;

export function getPagination(query?: Partial<PaginationQuery>) {
  const page = query?.page ?? DEFAULT_PAGE;
  const size = query?.size ?? DEFAULT_PAGE_SIZE;

  return {
    page,
    size,
    skip: (page - 1) * size,
    take: size === 0 ? undefined : size,
    isDefault: page === DEFAULT_PAGE && size === DEFAULT_PAGE_SIZE,
  };
}

export function buildPaginationMeta({ page, size }: PaginationQuery, totalItems: number): PaginationMetaResponse {
  return {
    page,
    size,
    totalItems,
    totalPages: size === 0 ? 1 : Math.ceil(totalItems / size),
  };
}
