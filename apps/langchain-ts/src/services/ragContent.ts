function formatInstituicoes(grupo: any): string {
  const vinculos = Array.isArray(grupo.instituicoes) ? grupo.instituicoes : [];
  if (vinculos.length === 0) return 'Sede: N/A';
  return vinculos.map((vinculo: any) => {
    const instituicao = vinculo.instituicao;
    const tipo = vinculo.tipoRelacao === 'SEDE' ? 'Sede' : 'Parceira';
    const sigla = instituicao?.sigla ? ` (${instituicao.sigla})` : '';
    const estado = instituicao?.estado?.nome ? ` - Estado: ${instituicao.estado.nome}` : '';
    const unidade = vinculo.unidade || vinculo.unidadeUf
      ? ` - Unidade: ${vinculo.unidade || 'N/A'}${vinculo.unidadeUf ? ` - UF: ${vinculo.unidadeUf}` : ''}`
      : '';
    return `${tipo}: ${instituicao?.nome || 'N/A'}${sigla}${estado}${unidade}`;
  }).join('\n');
}

export function buildGroupContent(grupo: any): string {
  let content = `Grupo de Pesquisa: ${grupo.nome}\n`;
  content += `DGP ID: ${grupo.dgpId || 'N/A'}\n`;
  content += `Instituicoes:\n${formatInstituicoes(grupo)}\n`;
  content += `Area Predominante: ${grupo.areaPredominante || 'N/A'}\n`;
  content += `Ano de Formação: ${grupo.anoFormacao || 'N/A'}\n`;
  if (grupo.cidade || grupo.uf || grupo.logradouro) {
    content += `Localização: ${[grupo.logradouro, grupo.bairro, grupo.cidade, grupo.uf, grupo.cep].filter(Boolean).join(', ')}\n`;
  }
  if (grupo.email || grupo.telefone || grupo.website) {
    content += `Contato: ${[grupo.email ? `Email: ${grupo.email}` : null, grupo.telefone ? `Tel: ${grupo.telefone}` : null, grupo.website ? `Site: ${grupo.website}` : null].filter(Boolean).join(' | ')}\n`;
  }
  content += `Repercussão: ${grupo.repercussao || 'N/A'}\n`;

  const areas = grupo.areasConhecimento.map((item: any) => item.area?.nome).filter(Boolean);
  if (areas.length > 0) content += `Áreas de Conhecimento: ${areas.join(', ')}\n`;
  if (grupo.linhasPesquisa.length > 0) {
    content += `Linhas de Pesquisa:\n`;
    for (const linha of grupo.linhasPesquisa) content += `- ${linha.titulo}: ${linha.objetivo || 'Sem objetivo cadastrado'}\n`;
  }
  if (grupo.membros.length > 0) {
    content += `Membros do Grupo:\n`;
    for (const membro of grupo.membros) {
      const leaderTag = membro.eLider ? ' [LÍDER DO GRUPO]' : '';
      content += `- ${membro.pesquisador?.nome || 'N/A'}${leaderTag} (${membro.pesquisador?.tipo || 'N/A'}, ${membro.pesquisador?.formacaoAcademica || 'N/A'})\n`;
    }
  }
  return content;
}

function getInstitutionSummary(grupo: any): string {
  const vinculos = Array.isArray(grupo?.instituicoes) ? grupo.instituicoes : [];
  const sede = vinculos.find((vinculo: any) => vinculo.tipoRelacao === 'SEDE') ?? vinculos[0];
  return sede?.instituicao?.sigla || sede?.instituicao?.nome || 'N/A';
}

export function buildResearcherContent(pesquisador: any): string {
  let content = `Pesquisador: ${pesquisador.nome}\n`;
  content += `Lattes ID: ${pesquisador.lattesId || 'N/A'}\n`;
  content += `Tipo: ${pesquisador.tipo || 'N/A'}\n`;
  content += `Formação Acadêmica: ${pesquisador.formacaoAcademica || 'N/A'}\n`;
  content += `Indicadores OpenAlex: H-Index = ${pesquisador.indexH ?? 'N/A'}, i10-Index = ${pesquisador.indexI10 ?? 'N/A'}\n`;
  content += `OpenAlex ID: ${pesquisador.openAlexId || 'N/A'} | ORCID ID: ${pesquisador.orcidId || 'N/A'}\n`;

  const areas = pesquisador.areasConhecimento.map((item: any) => item.area?.nome).filter(Boolean);
  if (areas.length > 0) content += `Áreas de Conhecimento: ${areas.join(', ')}\n`;
  const groups = pesquisador.membrosGrupo.map((member: any) =>
    `${member.grupoPesquisa.nome} (${getInstitutionSummary(member.grupoPesquisa)})`);
  if (groups.length > 0) content += `Grupos de Pesquisa Associados: ${groups.join(', ')}\n`;
  content += `Produções acadêmicas associadas: ${pesquisador._count.producoes}.\n`;
  return content;
}

export function buildLineContent(linha: any): string {
  let content = `Linha de Pesquisa: ${linha.titulo}\n`;
  content += `Objetivo: ${linha.objetivo || 'Sem objetivo cadastrado'}\n`;
  const keywords = linha.palavrasChave.map((item: any) => item.palavraChave?.termo).filter(Boolean);
  if (keywords.length > 0) content += `Palavras-chave: ${keywords.join(', ')}\n`;
  const sectors = linha.setoresAplicacao.map((item: any) => item.setorAplicacao?.nome).filter(Boolean);
  if (sectors.length > 0) content += `Setores de Atividade/Aplicação: ${sectors.join(', ')}\n`;
  const members = linha.membros.map((item: any) => item.pesquisador?.nome).filter(Boolean);
  if (members.length > 0) content += `Pesquisadores da linha: ${members.join(', ')}\n`;
  content += `Grupo de Pesquisa Associado: ${linha.grupo?.nome || 'N/A'} (${getInstitutionSummary(linha.grupo)})\n`;
  return content;
}

export function buildProductionContent(producao: any): string {
  let content = `Produção Acadêmica: ${producao.titulo}\n`;
  content += `Tipo: ${producao.tipo}\n`;
  content += `Ano: ${producao.ano || 'N/A'} | Veículo: ${producao.veiculo || 'N/A'}\n`;
  content += `DOI: ${producao.doi || 'N/A'} | URL: ${producao.url || 'N/A'}\n`;
  content += `ISSN: ${producao.issn || 'N/A'} | Qualis: ${producao.qualis || 'N/A'}\n`;
  const authors = producao.autores.map((item: any) => item.pesquisador?.nome).filter(Boolean);
  if (authors.length > 0) content += `Autores/Pesquisadores: ${authors.join(', ')}\n`;
  const keywords = producao.palavrasChave.map((item: any) => item.palavraChave?.termo).filter(Boolean);
  if (keywords.length > 0) content += `Palavras-chave: ${keywords.join(', ')}\n`;
  if (producao.resumo) content += `Resumo:\n${producao.resumo}\n`;
  return content;
}
