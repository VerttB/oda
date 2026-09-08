import { z } from 'zod';

const uniqueUuidArray = z.array(z.string().uuid()).refine(
  (items) => new Set(items).size === items.length,
  'IDs duplicados nao sao permitidos.',
);

export const CreateLinhaPesquisaRequestSchema = z.object({
  titulo: z.string().min(2).max(255),
  objetivo: z.string().optional(),
  grupoId: z.string().uuid(),
  pesquisadorIds: uniqueUuidArray.optional(),
  palavraChaveIds: uniqueUuidArray.optional(),
  setorAplicacaoIds: uniqueUuidArray.optional(),
});

export const UpdateLinhaPesquisaRequestSchema =
  CreateLinhaPesquisaRequestSchema.partial();

export type CreateLinhaPesquisaRequest = z.infer<
  typeof CreateLinhaPesquisaRequestSchema
>;
export type UpdateLinhaPesquisaRequest = z.infer<
  typeof UpdateLinhaPesquisaRequestSchema
>;
