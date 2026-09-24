import {
  FindAllAreaConhecimentoQuerySchema,
  FindAllGruposPesquisaQuerySchema,
  FindAllInstituicaoQuerySchema,
  FindAllLinhaPesquisaQuerySchema,
  FindAllPesquisadoresQuerySchema,
  FindAllProducoesQuerySchema,
} from '@oda/shared-types';

describe('list query sorting validation', () => {
  it.each([
    [FindAllGruposPesquisaQuerySchema, 'anoFormacao'],
    [FindAllPesquisadoresQuerySchema, 'indexH'],
    [FindAllInstituicaoQuerySchema, 'sigla'],
    [FindAllLinhaPesquisaQuerySchema, 'titulo'],
    [FindAllProducoesQuerySchema, 'ano'],
    [FindAllAreaConhecimentoQuerySchema, 'tipo'],
  ])('aceita ordena��o permitida pelo recurso', (schema, ordenarPor) => {
    expect(schema.safeParse({ ordenarPor, ordem: 'desc' }).success).toBe(true);
  });

  it.each([
    FindAllGruposPesquisaQuerySchema,
    FindAllPesquisadoresQuerySchema,
    FindAllInstituicaoQuerySchema,
    FindAllLinhaPesquisaQuerySchema,
    FindAllProducoesQuerySchema,
    FindAllAreaConhecimentoQuerySchema,
  ])('rejeita campo e dire��o de ordena��o desconhecidos', (schema) => {
    expect(schema.safeParse({ ordenarPor: 'campoInexistente' }).success).toBe(false);
    expect(schema.safeParse({ ordem: 'aleatoria' }).success).toBe(false);
  });
});
