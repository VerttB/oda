import { z } from 'zod';
import { createPaginatedResponseSchema, PaginationQuerySchema } from './pagination';
import { ProducaoResponseSchema } from './producoes';

export const DecisaoProducaoGrupoSchema = z.enum(['CONFIRMADO', 'REJEITADO', 'INCONCLUSIVO']);
const RevisaoProducaoGrupoFields = {
  decisao: DecisaoProducaoGrupoSchema,
  justificativa: z.string().trim().min(10).max(2000),
  evidencia: z.string().trim().min(10).max(2000).nullable().optional(),
  fonteUrl: z.url({ protocol: /^https?$/ }).max(2048).nullable().optional(),
};

export const RevisarProducaoGrupoSchema = z.strictObject({
  ...RevisaoProducaoGrupoFields,
  versaoEsperada: z.number().int().min(0).max(2147483646),
}).refine(value => value.decisao !== 'CONFIRMADO' || Boolean(value.evidencia), {
  path: ['evidencia'],
  message: 'Descreva a evidência de que a produção foi realizada pelo grupo.',
});

export const RevisaoProducaoGrupoResponseSchema = z.object({
  versao: z.number().int().nonnegative(),
  revisao: z.object({
    ...RevisaoProducaoGrupoFields,
    revisor: z.string(),
    revisadoEm: z.iso.datetime(),
  }).nullable(),
});

export const ProducoesConfirmadasQuerySchema = PaginationQuerySchema.extend({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  size: z.coerce.number().int().min(1).max(100).default(30),
});

export const ProducoesConfirmadasResponseSchema = createPaginatedResponseSchema(
  ProducaoResponseSchema.pick({ id: true, titulo: true, ano: true, tipo: true, doi: true, url: true }).strip(),
);

export type RevisarProducaoGrupo = z.infer<typeof RevisarProducaoGrupoSchema>;
export type ProducoesConfirmadasQuery = z.infer<typeof ProducoesConfirmadasQuerySchema>;
