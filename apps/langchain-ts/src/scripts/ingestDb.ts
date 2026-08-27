import { randomUUID } from 'crypto';
import { embeddings } from '../core/config';
import { prisma } from '../core/db';



function splitText(text: string, chunkSize = 1000, chunkOverlap = 200): string[] {
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  let startIndex = 0;
  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;
    if (endIndex >= text.length) {
      chunks.push(text.slice(startIndex));
      break;
    }
    let splitIndex = endIndex;
    const overlapZone = text.slice(endIndex - chunkOverlap, endIndex);
    const lastNewline = overlapZone.lastIndexOf('\n');
    if (lastNewline !== -1) {
      splitIndex = endIndex - chunkOverlap + lastNewline + 1;
    } else {
      const lastSpace = overlapZone.lastIndexOf(' ');
      if (lastSpace !== -1) {
        splitIndex = endIndex - chunkOverlap + lastSpace + 1;
      }
    }
    chunks.push(text.slice(startIndex, splitIndex));
    const nextStartIndex = splitIndex - chunkOverlap;
    if (nextStartIndex <= startIndex) {
      startIndex = endIndex - chunkOverlap;
    } else {
      startIndex = nextStartIndex;
    }
  }
  return chunks;
}

// Verifica se uma entidade precisa de vetorização (se é nova ou foi atualizada)
async function needVectorization(sourceType: any, sourceId: string, dbUpdatedAt: Date): Promise<boolean> {
  const existingDoc = await prisma.ragDocument.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType,
        sourceId
      }
    },
    select: {
      atualizadoEm: true
    }
  });

  if (!existingDoc) return true; // Novo registro

  // Se foi atualizado no banco depois da última vetorização
  return dbUpdatedAt.getTime() > existingDoc.atualizadoEm.getTime();
}

const textSplitter = { splitText };

function formatInstituicoesGrupo(grupo: any): string {
  const vinculos = Array.isArray(grupo.instituicoes) ? grupo.instituicoes : [];
  if (vinculos.length > 0) {
    return vinculos.map((vinculo: any) => {
      const instituicao = vinculo.instituicao;
      const tipo = vinculo.tipoRelacao === 'SEDE' ? 'Sede' : 'Parceira';
      const sigla = instituicao?.sigla ? ` (${instituicao.sigla})` : '';
      const estado = instituicao?.estado?.nome ? ` - Estado: ${instituicao.estado.nome}` : '';
      const unidade = vinculo.unidade ? ` - Unidade: ${vinculo.unidade}` : '';
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
  const grupos = await prisma.grupoPesquisa.findMany({
    include: {
      instituicoes: { include: { instituicao: { include: { estado: true } } } },
      linhasPesquisa: true,
      membros: { include: { pesquisador: true } },
      areasConhecimento: { include: { area: true } }
    }
  });

  let gruposSincronizados = 0;
  for (const g of grupos) {
    const sync = await needVectorization('GRUPO_PESQUISA', g.id, g.atualizadoEm);
    if (!sync) continue;

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

    await saveRagDocument('GRUPO_PESQUISA', g.id, g.nome, content, { dgpId: g.dgpId || '' });
    gruposSincronizados++;
  }
  console.log(`[ETL-IA] Grupos de Pesquisa processados: ${gruposSincronizados} sincronizados.`);

  // ==========================================
  // B. Sincronização de Pesquisadores
  // ==========================================
  console.log('👥 Analisando Pesquisadores...');
  const pesquisadores = await prisma.pesquisador.findMany({
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
      producoes: { include: { producao: true } },
      areasConhecimento: { include: { area: true } }
    }
  });

  let pesquisadoresSincronizados = 0;
  for (const p of pesquisadores) {
    const sync = await needVectorization('PESQUISADOR', p.id, p.atualizadoEm);
    if (!sync) continue;

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

    const artigos = p.producoes
      .filter(pr => pr.producao.tipo === 'ARTIGO')
      .map(pr => `"${pr.producao.titulo}" (${pr.producao.ano || ''})`);
    if (artigos.length > 0) {
      content += `Artigos Publicados:\n` + artigos.map(a => `- ${a}`).join('\n') + '\n';
    }

    await saveRagDocument('PESQUISADOR', p.id, p.nome, content, { lattesId: p.lattesId || '' });
    pesquisadoresSincronizados++;
  }
  console.log(`[ETL-IA] Pesquisadores processados: ${pesquisadoresSincronizados} sincronizados.`);

  // ==========================================
  // C. Sincronização de Produções
  // ==========================================
  console.log('📚 Analisando Produções...');
  const producoes = await prisma.producao.findMany({
    include: { autores: { include: { pesquisador: true } } }
  });

  let producoesSincronizadas = 0;
  for (const pr of producoes) {
    const sync = await needVectorization('PRODUCAO', pr.id, pr.atualizadoEm);
    if (!sync) continue;

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

    await saveRagDocument('PRODUCAO', pr.id, pr.titulo, content, { doi: pr.doi || '' });
    producoesSincronizadas++;
  }
  console.log(`[ETL-IA] Produções processadas: ${producoesSincronizadas} sincronizadas.`);

  // ==========================================
  // D. Sincronização de Linhas de Pesquisa
  // ==========================================
  console.log('🔬 Analisando Linhas de Pesquisa...');
  const linhas = await prisma.linhaPesquisa.findMany({
    include: {
      grupo: {
        include: {
          instituicoes: { include: { instituicao: true } },
        },
      },
      palavrasChave: { include: { palavraChave: true } },
      setoresAplicacao: { include: { setorAplicacao: true } }
    }
  });

  let linhasSincronizadas = 0;
  for (const lp of linhas) {
    const sync = await needVectorization('LINHA_PESQUISA', lp.id, lp.atualizadoEm);
    if (!sync) continue;

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

    await saveRagDocument('LINHA_PESQUISA', lp.id, lp.titulo, content, { grupoId: lp.grupoId });
    linhasSincronizadas++;
  }
  console.log(`[ETL-IA] Linhas de Pesquisa processadas: ${linhasSincronizadas} sincronizadas.`);

  console.log('🎉 Sincronização incremental concluída com sucesso!');
  process.exit(0);
}

async function saveRagDocument(sourceType: any, sourceId: string, titulo: string, content: string, metadata: any) {
  try {
    const doc = await prisma.ragDocument.upsert({
      where: {
        sourceType_sourceId: {
          sourceType,
          sourceId,
        },
      },
      update: {
        titulo,
        conteudo: content,
        metadata,
      },
      create: {
        sourceType,
        sourceId,
        titulo,
        conteudo: content,
        metadata,
      },
    });

    await prisma.ragChunk.deleteMany({
      where: { documentId: doc.id }
    });

    const chunks = textSplitter.splitText(content);
    const vectors = await embeddings.embedDocuments(chunks);

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const vector = vectors[i];
      const vectorStr = `[${vector.join(',')}]`;
      const chunkId = randomUUID();

      await prisma.$executeRawUnsafe(
        `INSERT INTO "rag_chunk" ("id", "document_id", "conteudo", "embedding", "ordem", "metadata", "atualizado_em") 
         VALUES ($1, $2, $3, $4::vector, $5, $6, NOW())`,
        chunkId, doc.id, chunkText, vectorStr, i, JSON.stringify(metadata)
      );
    }

    console.log(`[VETORIZAÇÃO] ✅ ${sourceType} "${titulo}" vetorizado com ${chunks.length} chunks.`);
  } catch (error: any) {
    console.error(`❌ Erro ao vetorizar ${sourceType} "${titulo}":`, error.message);
  }
}

main().catch(error => {
  console.error('❌ Erro fatal no script de ingestão:', error);
  process.exit(1);
});
