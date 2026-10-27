import { RagSourceType } from '@oda/database';
import { prisma } from '../core/db';
import { indexRagDocument } from '../services/ragIndexer';

const PAGE_SIZE = 25;

async function* paginate<T extends { id: string }>(loadPage: (after?: string) => Promise<T[]>) {
  let after: string | undefined;
  while (true) {
    const rows = await loadPage(after);
    if (rows.length === 0) return;
    for (const row of rows) yield row;
    if (rows.length < PAGE_SIZE) return;
    after = rows[rows.length - 1].id;
  }
}

function formatUnidadeVinculo(vinculo: any): string {
  const nome = vinculo.unidade;
  const uf = vinculo.unidadeUf ? ` - UF: ${vinculo.unidadeUf}` : '';

  if (!nome && !uf) return '';
  return ` - Unidade: ${nome || 'N/A'}${uf}`;
}

function formatInstituicoesGrupo(grupo: any): string {
  const vinculos = Array.isArray(grupo.instituicoes) ? grupo.instituicoes : [];
  if (vinculos.length > 0) {
    return vinculos.map((vinculo: any) => {
      const instituicao = vinculo.instituicao;
      const tipo = vinculo.tipoRelacao === 'SEDE' ? 'Sede' : 'Parceira';
      const sigla = instituicao?.sigla ? ` (${instituicao.sigla})` : '';
      const estado = instituicao?.estado?.nome ? ` - Estado: ${instituicao.estado.nome}` : '';
      const unidade = formatUnidadeVinculo(vinculo);
      return `${tipo}: ${instituicao?.nome || 'N/A'}${sigla}${estado}${unidade}`;
    }).join('\n');
  }

  return 'Sede: N/A';
}

function getInstituicaoResumoGrupo(grupo: any): string {
  const vinculos = Array.isArray(grupo?.instituicoes) ? grupo.instituicoes : [];
  const sede = vinculos.find((vinculo: any) => vinculo.tipoRelacao === 'SEDE') ?? vinculos[0];
  const instituicao = sede?.instituicao;
  return `${instituicao?.sigla || instituicao?.nome || ''}`;
}

async function main() {
  console.log('🔄 Iniciando sincronização incremental de embeddings (apenas novos e atualizados)...');

  // ==========================================
  // A. Sincronização de Grupos de Pesquisa
  // ==========================================
  console.log('📦 Analisando Grupos de Pesquisa...');
  let gruposSincronizados = 0;
  for await (const g of paginate(after => prisma.grupoPesquisa.findMany({
    take: PAGE_SIZE,
    ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    orderBy: { id: 'asc' },
    include: {
      instituicoes: { include: { instituicao: { include: { estado: true } } } },
      linhasPesquisa: true,
      membros: { include: { pesquisador: true } },
      areasConhecimento: { include: { area: true } }
    }
  }))) {

    let content = `Grupo de Pesquisa: ${g.nome}\n`;
    content += `DGP ID: ${g.dgpId || 'N/A'}\n`;
    content += `Instituicoes:\n${formatInstituicoesGrupo(g)}\n`;
    content += `Area Predominante: ${g.areaPredominante || 'N/A'}\n`;
    content += `Ano de Formação: ${g.anoFormacao || 'N/A'}\n`;
    if (g.cidade || g.uf || g.logradouro) {
      content += `Localização: ${[g.logradouro, g.bairro, g.cidade, g.uf, g.cep].filter(Boolean).join(', ')}\n`;
    }
    if (g.email || g.telefone || g.website) {
      content += `Contato: ${[g.email ? `Email: ${g.email}` : null, g.telefone ? `Tel: ${g.telefone}` : null, g.website ? `Site: ${g.website}` : null].filter(Boolean).join(' | ')}\n`;
    }
    content += `Repercussão: ${g.repercussao || 'N/A'}\n`;

    const areas = g.areasConhecimento.map(ac => ac.area?.nome).filter(Boolean);
    if (areas.length > 0) {
      content += `Áreas de Conhecimento: ${areas.join(', ')}\n`;
    }
    
    if (g.linhasPesquisa.length > 0) {
      content += `Linhas de Pesquisa:\n`;
      for (const lp of g.linhasPesquisa) {
        content += `- ${lp.titulo}: ${lp.objetivo || 'Sem objetivo cadastrado'}\n`;
      }
    }
    
    if (g.membros.length > 0) {
      content += `Membros do Grupo:\n`;
      for (const m of g.membros) {
        const tagLider = m.eLider ? ' [LÍDER DO GRUPO]' : '';
        content += `- ${m.pesquisador?.nome || 'N/A'}${tagLider} (${m.pesquisador?.tipo || 'N/A'}, ${m.pesquisador?.formacaoAcademica || 'N/A'})\n`;
      }
    }

    const result = await saveRagDocument(RagSourceType.GRUPO_PESQUISA, g.id, g.nome, content, { dgpId: g.dgpId || '' });
    if (result.indexed) gruposSincronizados++;
  }
  console.log(`[ETL-IA] Grupos de Pesquisa processados: ${gruposSincronizados} sincronizados.`);

  // ==========================================
  // B. Sincronização de Pesquisadores
  // ==========================================
  console.log('👥 Analisando Pesquisadores...');
  let pesquisadoresSincronizados = 0;
  for await (const p of paginate(after => prisma.pesquisador.findMany({
    take: PAGE_SIZE,
    ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    orderBy: { id: 'asc' },
    include: {
      membrosGrupo: {
        include: {
          grupoPesquisa: {
            include: {
              instituicoes: { include: { instituicao: true } },
            },
          },
        },
      },
      _count: { select: { producoes: true } },
      areasConhecimento: { include: { area: true } }
    }
  }))) {

    let content = `Pesquisador: ${p.nome}\n`;
    content += `Lattes ID: ${p.lattesId || 'N/A'}\n`;
    content += `Tipo: ${p.tipo || 'N/A'}\n`;
    content += `Formação Acadêmica: ${p.formacaoAcademica || 'N/A'}\n`;
    content += `Indicadores OpenAlex: H-Index = ${p.indexH ?? 'N/A'}, i10-Index = ${p.indexI10 ?? 'N/A'}\n`;
    content += `OpenAlex ID: ${p.openAlexId || 'N/A'} | ORCID ID: ${p.orcidId || 'N/A'}\n`;

    const areas = p.areasConhecimento.map(ac => ac.area?.nome).filter(Boolean);
    if (areas.length > 0) {
      content += `Áreas de Conhecimento: ${areas.join(', ')}\n`;
    }

    const gruposAssoc = p.membrosGrupo.map(mg => `${mg.grupoPesquisa.nome} (${getInstituicaoResumoGrupo(mg.grupoPesquisa)})`);
    if (gruposAssoc.length > 0) {
      content += `Grupos de Pesquisa Associados: ${gruposAssoc.join(', ')}\n`;
    }

    content += `Produções acadêmicas associadas: ${p._count.producoes}.\n`;

    const result = await saveRagDocument(RagSourceType.PESQUISADOR, p.id, p.nome, content, { lattesId: p.lattesId || '' });
    if (result.indexed) pesquisadoresSincronizados++;
  }
  console.log(`[ETL-IA] Pesquisadores processados: ${pesquisadoresSincronizados} sincronizados.`);

  // ==========================================
  // C. Sincronização de Produções
  // ==========================================
  console.log('📚 Analisando Produções...');
  let producoesSincronizadas = 0;
  for await (const pr of paginate(after => prisma.producao.findMany({
    take: PAGE_SIZE,
    ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    orderBy: { id: 'asc' },
    include: { autores: { include: { pesquisador: true } } }
  }))) {

    let content = `Produção Acadêmica: ${pr.titulo}\n`;
    content += `Tipo: ${pr.tipo}\n`;
    content += `Ano: ${pr.ano || 'N/A'} | Veículo: ${pr.veiculo || 'N/A'}\n`;
    content += `DOI: ${pr.doi || 'N/A'} | URL: ${pr.url || 'N/A'}\n`;
    
    const autoresNomes = pr.autores.map(a => a.pesquisador?.nome).filter(Boolean);
    if (autoresNomes.length > 0) {
      content += `Autores/Pesquisadores: ${autoresNomes.join(', ')}\n`;
    }
    
    if (pr.resumo) {
      content += `Resumo:\n${pr.resumo}\n`;
    }

    const result = await saveRagDocument(RagSourceType.PRODUCAO, pr.id, pr.titulo, content, { doi: pr.doi || '' });
    if (result.indexed) producoesSincronizadas++;
  }
  console.log(`[ETL-IA] Produções processadas: ${producoesSincronizadas} sincronizadas.`);

  // ==========================================
  // D. Sincronização de Linhas de Pesquisa
  // ==========================================
  console.log('🔬 Analisando Linhas de Pesquisa...');
  let linhasSincronizadas = 0;
  for await (const lp of paginate(after => prisma.linhaPesquisa.findMany({
    take: PAGE_SIZE,
    ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    orderBy: { id: 'asc' },
    include: {
      grupo: {
        include: {
          instituicoes: { include: { instituicao: true } },
        },
      },
      palavrasChave: { include: { palavraChave: true } },
      setoresAplicacao: { include: { setorAplicacao: true } }
    }
  }))) {

    let content = `Linha de Pesquisa: ${lp.titulo}\n`;
    content += `Objetivo: ${lp.objetivo || 'Sem objetivo cadastrado'}\n`;

    const kw = lp.palavrasChave.map(pc => pc.palavraChave?.termo).filter(Boolean);
    if (kw.length > 0) {
      content += `Palavras-chave: ${kw.join(', ')}\n`;
    }

    const sectors = lp.setoresAplicacao.map(sa => sa.setorAplicacao?.nome).filter(Boolean);
    if (sectors.length > 0) {
      content += `Setores de Atividade/Aplicação: ${sectors.join(', ')}\n`;
    }

    content += `Grupo de Pesquisa Associado: ${lp.grupo?.nome || 'N/A'} (${getInstituicaoResumoGrupo(lp.grupo)})\n`;

    const result = await saveRagDocument(RagSourceType.LINHA_PESQUISA, lp.id, lp.titulo, content, { grupoId: lp.grupoId });
    if (result.indexed) linhasSincronizadas++;
  }
  console.log(`[ETL-IA] Linhas de Pesquisa processadas: ${linhasSincronizadas} sincronizadas.`);

  console.log('🎉 Sincronização incremental concluída com sucesso!');
}

async function saveRagDocument(sourceType: RagSourceType, sourceId: string, title: string, content: string, metadata: Record<string, unknown>) {
  const result = await indexRagDocument(prisma, { sourceType, sourceId, title, content, metadata });
  if (result.indexed) {
    console.log(`[VETORIZACAO] ${sourceType} "${title}" atualizado com ${result.chunks} chunks.`);
  }
  return result;
}

main().catch(error => {
  console.error('❌ Erro fatal no script de ingestão:', error);
  process.exit(1);
}).finally(() => prisma.$disconnect());
