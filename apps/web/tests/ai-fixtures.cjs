// Dados exclusivamente para testes de interface. Nunca são usados pela aplicação.
exports.group = (id, nome) => ({
  id, nome, dgpId: null, anoFormacao: 2000, areaPredominante: 'Computação',
  repercussao: 'Registro simulado para validar a interface.', situacao: 'CERTIFICADO',
  email: null, telefone: null, website: null, logradouro: null, numero: null,
  complemento: null, bairro: null, cidade: null, uf: 'BA', cep: null,
  latitude: null, longitude: null, instituicoes: [],
});
exports.person = { id: 'person-test', nome: 'Pessoa de teste', lattesId: '1234567890123456', tipo: 'PESQUISADOR', formacaoAcademica: 'DOUTORADO', openAlexId: null, orcidId: null, imageUrl: null, indexH: null, indexI10: null };
exports.work = { id: 'work-test', titulo: 'Produção de teste', ano: 2024, tipo: 'ARTIGO', doi: null, url: null, veiculo: null, resumo: 'Resumo de teste.', qualis: null, issn: null };
exports.line = { id: 'line-test', titulo: 'Linha de teste', dgpId: null, objetivo: 'Objetivo de teste.', grupoId: 'group-test' };
exports.paginated = (data, page = 1, totalItems = data.length) => ({ data, meta: { page, size: 10, totalItems, totalPages: Math.ceil(totalItems / 10) } });
exports.answer = {
  output: 'Resposta de **teste** baseada no acervo. [S1]', model: 'modelo-teste', provider: 'local', createdAt: '2026-10-29T00:00:00.000Z', grounded: true, retrievalAttempts: 1,
  sources: [{ ref: 'S1', sourceType: 'grupo_pesquisa', sourceId: 'group-test', title: 'Grupo de teste', excerpt: 'Trecho recuperado para o teste de interface.' }],
};
