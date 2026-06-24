import { z } from 'zod';

export const PageGroupItemInfoSchema = z.object({
  nome: z.string(),
  area: z.string(),
  instituicao: z.string(),
  key: z.string(),
});
export type PageGroupItemInfo = z.infer<typeof PageGroupItemInfoSchema>;

export const RequestTypeSchema = z.object({
  url: z.string(),
  userData: z.object({
    chave: z.string(),
    direction: z.string(),
  }),
  uniqueKey: z.string(),
});
export type RequestType = z.infer<typeof RequestTypeSchema>;

export const AddressSchema = z.object({
  cep: z.string().optional().nullable(),
  localidade: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  long: z.number().optional().nullable(),
});
export type Address = z.infer<typeof AddressSchema>;

export const MembrosGrupoSchema = z.object({
  nome: z.string(),
  lattes: z.string().optional().nullable(),
  lattesId: z.string().optional().nullable(),
  formacaoAcademica: z.string().optional().nullable(),
  categoriaLattes: z.string().optional().nullable(),
  areas: z.array(z.string()).optional().nullable(),
  gruposAssociados: z.array(z.string()).optional().nullable(),
  linhasAssociadas: z.array(z.string()).optional().nullable(),
});
export type MembrosGrupo = z.infer<typeof MembrosGrupoSchema>;

export const FormationSchema = z.object({
  anoInicio: z.string().optional().nullable(),
  anoFim: z.string().optional().nullable(),
  nome: z.string().optional().nullable(),
});
export type Formation = z.infer<typeof FormationSchema>;

export const ArticleSchema = z.object({
  titulo: z.string(),
  doi: z.string().optional().nullable(),
  volume: z.string().optional().nullable(),
  issn: z.string().optional().nullable(),
  nomePeriodico: z.string().optional().nullable(),
  veiculo: z.string().optional().nullable(),
  paginaInicial: z.string().optional().nullable(),
  ano: z.string().optional().nullable(),
  resumo: z.string().optional().nullable(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const FullPaperSchema = z.object({
  titulo: z.string(),
  ano: z.string().optional().nullable(),
  doi: z.string().optional().nullable(),
});
export type FullPaper = z.infer<typeof FullPaperSchema>;

export const BookChaptersSchema = z.object({
  titulo: z.string(),
  ano: z.string().optional().nullable(),
  doi: z.string().optional().nullable(),
  volume: z.string().optional().nullable(),
  paginas: z.string().optional().nullable(),
  editora: z.string().optional().nullable(),
  veiculo: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
});
export type BookChapters = z.infer<typeof BookChaptersSchema>;

export const LinhaPesquisaGrupoSchema = z.object({
  nome: z.string(),
  objetivo: z.string().optional().nullable(),
  areasConhecimento: z.array(z.string()).optional().nullable(),
  plavrasChaves: z.array(z.string()).optional().nullable(),
  setoresAplicacao: z.array(z.string()).optional().nullable(),
});
export type LinhaPesquisaGrupo = z.infer<typeof LinhaPesquisaGrupoSchema>;

export const DgpGroupSchema = z.object({
  id_dgp: z.string().optional().nullable(),
  idDgp: z.string().optional().nullable(),
  nome: z.string(),
  situacao: z.string().optional().nullable(),
  repercussao: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  instituicao: z.string(),
  ano_formacao: z.union([z.number(), z.string()]).optional().nullable(),
  anoFormacao: z.union([z.number(), z.string()]).optional().nullable(),
  endereco: AddressSchema,
  membros: z.array(MembrosGrupoSchema),
  linhas: z.union([LinhaPesquisaGrupoSchema, z.array(LinhaPesquisaGrupoSchema)]).optional().nullable(),
});
export type DgpGroup = z.infer<typeof DgpGroupSchema>;

export const LattesResearcherSchema = z.object({
  nome: z.string(),
  lattesId: z.string().optional().nullable(),
  orcid: z.string().optional().nullable(),
  orcidId: z.string().optional().nullable(),
  artigos: z.array(ArticleSchema).optional().nullable(),
  livrosCapitulos: z.array(BookChaptersSchema).optional().nullable(),
});
export type LattesResearcher = z.infer<typeof LattesResearcherSchema>;
