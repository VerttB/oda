import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { RagSourceType } from '@oda/database';
import { prisma } from '../core/db';
import { indexRagDocument } from '../services/ragIndexer';

const BATCH_SIZE = 50;
const PAGE_SIZE = 25;
const INDEX_CONCURRENCY = 5;
const UF = 'BA';
const REQUIRED_ACRONYMS = ['ACSO', 'G2BC', 'NPAI'] as const;
const MANIFEST_PATH = path.resolve(__dirname, '../../data/validation-batches/grupos-ba-50.json');
const PROGRESS_PATH = path.resolve(__dirname, '../../data/validation-batches/grupos-ba-50.progress.json');

type GroupCandidate = { id: string; dgpId: string | null; nome: string };
type BatchEntry = GroupCandidate & {
  inclusion: 'required' | 'sample';
  matchedAcronym?: typeof REQUIRED_ACRONYMS[number];
};
type RelatedIds = {
  researcherIds: string[];
  lineIds: string[];
  sectorIds: string[];
  productionIds: string[];
};
type BatchManifest = {
  version: 2;
  createdAt: string;
  uf: typeof UF;
  limit: typeof BATCH_SIZE;
  requiredAcronyms: typeof REQUIRED_ACRONYMS;
  groups: BatchEntry[];
  related: RelatedIds;
  counts: {
    groups: number;
    researchers: number;
    lines: number;
    sectors: number;
    productions: number;
  };
};
type BatchProgress = {
  fingerprint: string;
  completed: Partial<Record<RagSourceType, string[]>>;
};

function hasAcronym(name: string, acronym: string): boolean {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const tokens = normalized.split(/[^A-Z0-9]+/).filter(Boolean);
  return tokens.includes(acronym);
}

function parseMode(args: string[]): 'prepare' | 'apply' | 'help' {
  if (args.includes('--help')) return 'help';
  const prepare = args.includes('--prepare');
  const apply = args.includes('--apply');
  if (prepare === apply) {
    throw new Error('Informe exatamente um modo: --prepare ou --apply --confirm 50.');
  }
  if (apply && !args.includes('--confirm') || apply && args[args.indexOf('--confirm') + 1] !== String(BATCH_SIZE)) {
    throw new Error('A geração exige a confirmação explícita: --apply --confirm 50.');
  }
  return prepare ? 'prepare' : 'apply';
}

async function selectBatch(): Promise<BatchManifest> {
  const candidates = await prisma.grupoPesquisa.findMany({
    where: { uf: UF },
    select: { id: true, dgpId: true, nome: true },
    orderBy: { id: 'asc' },
  });

  const required: BatchEntry[] = REQUIRED_ACRONYMS.map(acronym => {
    const matches = candidates.filter(group => hasAcronym(group.nome, acronym));
    if (matches.length !== 1) {
      const detail = matches.map(group => `${group.nome} [DGP ${group.dgpId ?? 'sem ID'}]`).join('; ') || 'nenhum grupo encontrado';
      throw new Error(`A sigla ${acronym} deve identificar exatamente um grupo com UF=${UF}; encontrados ${matches.length}: ${detail}.`);
    }
    return { ...matches[0], inclusion: 'required', matchedAcronym: acronym };
  });

  const requiredIds = new Set(required.map(group => group.id));
  const remaining = candidates
    .filter(group => !requiredIds.has(group.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, BATCH_SIZE - required.length)
    .map(group => ({ ...group, inclusion: 'sample' as const }));

  const groups = [...required, ...remaining];
  if (groups.length !== BATCH_SIZE) {
    throw new Error(`A seleção encontrou apenas ${groups.length} grupos da Bahia; são necessários ${BATCH_SIZE}.`);
  }

  const related = await collectRelatedIds(groups.map(group => group.id));
  return {
    version: 2,
    createdAt: new Date().toISOString(),
    uf: UF,
    limit: BATCH_SIZE,
    requiredAcronyms: REQUIRED_ACRONYMS,
    groups,
    related,
    counts: {
      groups: groups.length,
      researchers: related.researcherIds.length,
      lines: related.lineIds.length,
      sectors: related.sectorIds.length,
      productions: related.productionIds.length,
    },
  };
}

async function collectRelatedIds(groupIds: string[]): Promise<RelatedIds> {
  const groups = await prisma.grupoPesquisa.findMany({
    where: { id: { in: groupIds } },
    select: {
      id: true,
      membros: { select: { pesquisadorId: true } },
      linhasPesquisa: {
        select: {
          id: true,
          membros: { select: { pesquisadorId: true } },
          setoresAplicacao: { select: { setorAplicacaoId: true } },
        },
      },
    },
  });
  if (groups.length !== groupIds.length) {
    throw new Error(`Esperados ${groupIds.length} grupos para expandir o lote, encontrados ${groups.length}.`);
  }

  const researcherIds = new Set<string>();
  const lineIds = new Set<string>();
  const sectorIds = new Set<string>();
  for (const group of groups) {
    for (const member of group.membros) researcherIds.add(member.pesquisadorId);
    for (const line of group.linhasPesquisa) {
      lineIds.add(line.id);
      for (const member of line.membros) researcherIds.add(member.pesquisadorId);
      for (const sector of line.setoresAplicacao) sectorIds.add(sector.setorAplicacaoId);
    }
  }

  const productionRows = researcherIds.size > 0
    ? await prisma.producaoPesquisador.findMany({
      where: { pesquisadorId: { in: [...researcherIds] } },
      select: { producaoId: true },
    })
    : [];
  const sortIds = (values: Set<string>) => [...values].sort((left, right) => left.localeCompare(right));

  return {
    researcherIds: sortIds(researcherIds),
    lineIds: sortIds(lineIds),
    sectorIds: sortIds(sectorIds),
    productionIds: [...new Set(productionRows.map(row => row.producaoId))].sort((left, right) => left.localeCompare(right)),
  };
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

async function* paginateSelectedPages<T extends { id: string }>(
  ids: string[],
  loadPage: (after?: string) => Promise<T[]>,
): AsyncGenerator<T[]> {
  let after: string | undefined;
  let yielded = 0;
  while (yielded < ids.length) {
    const page = await loadPage(after);
    if (page.length === 0) return;
    yielded += page.length;
    yield page;
    after = page[page.length - 1].id;
  }
}

async function processConcurrently<T>(items: T[], processItem: (item: T) => Promise<void>): Promise<T[]> {
  const completed: T[] = [];
  for (let offset = 0; offset < items.length; offset += INDEX_CONCURRENCY) {
    const batch = items.slice(offset, offset + INDEX_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(processItem));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') completed.push(batch[index]);
    });
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length > 0) {
      const messages = failures.map(result => result.reason instanceof Error ? result.reason.message : String(result.reason));
      const error = new Error(`${failures.length} indexacao(oes) falharam: ${messages.join(' | ')}`);
      Object.assign(error, { completed });
      throw error;
    }
  }
  return completed;
}

function progressFingerprint(manifest: BatchManifest): string {
  return createHash('sha256').update(JSON.stringify({
    groups: manifest.groups.map(({ id }) => id),
    related: manifest.related,
  })).digest('hex');
}

async function loadProgress(manifest: BatchManifest): Promise<BatchProgress> {
  const fingerprint = progressFingerprint(manifest);
  try {
    const progress = JSON.parse(await readFile(PROGRESS_PATH, 'utf8')) as BatchProgress;
    if (progress.fingerprint === fingerprint) return progress;
    console.warn('Checkpoint pertence a outro manifesto; um novo progresso será iniciado.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return { fingerprint, completed: {} };
}

async function saveProgress(progress: BatchProgress): Promise<void> {
  await mkdir(path.dirname(PROGRESS_PATH), { recursive: true });
  const temporaryPath = `${PROGRESS_PATH}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, PROGRESS_PATH);
}

function completedSet(progress: BatchProgress, sourceType: RagSourceType): Set<string> {
  return new Set(progress.completed[sourceType] ?? []);
}

async function indexWithProgress<T extends { id: string }>(
  items: T[],
  sourceType: RagSourceType,
  progress: BatchProgress,
  label: string,
  total: number,
  logEvery: number,
  processItem: (item: T) => Promise<void>,
): Promise<void> {
  const completed = completedSet(progress, sourceType);
  const pending = items.filter(item => !completed.has(item.id));
  for (let offset = 0; offset < pending.length; offset += INDEX_CONCURRENCY) {
    const batch = pending.slice(offset, offset + INDEX_CONCURRENCY);
    try {
      const succeeded = await processConcurrently(batch, processItem);
      succeeded.forEach(item => completed.add(item.id));
    } catch (error) {
      const succeeded = (error as Error & { completed?: T[] }).completed ?? [];
      succeeded.forEach(item => completed.add(item.id));
      progress.completed[sourceType] = [...completed].sort();
      await saveProgress(progress);
      throw error;
    }
    progress.completed[sourceType] = [...completed].sort();
    await saveProgress(progress);
    if (completed.size % logEvery < batch.length || completed.size === total) {
      console.log(`[${label} ${completed.size}/${total}]`);
    }
  }
}

function printBatch(manifest: BatchManifest): void {
  console.log(`Lote: ${manifest.groups.length} grupos | UF=${manifest.uf} | siglas obrigatórias: ${REQUIRED_ACRONYMS.join(', ')}`);
  console.log(`Entidades relacionadas: ${manifest.counts.researchers} pesquisadores, ${manifest.counts.lines} linhas, ${manifest.counts.sectors} setores (nas linhas), ${manifest.counts.productions} produções.`);
  console.table(manifest.groups.map((group, index) => ({
    ordem: index + 1,
    inclusao: group.matchedAcronym ? `${group.inclusion}: ${group.matchedAcronym}` : group.inclusion,
    grupo: group.nome,
    dgpId: group.dgpId ?? 'sem ID',
    id: group.id,
  })));
}

async function prepare(): Promise<void> {
  const manifest = await selectBatch();
  if (!process.argv.includes('--replace')) {
    let manifestExists = true;
    try {
      await access(MANIFEST_PATH);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') manifestExists = false;
      else throw error;
    }
    if (manifestExists) throw new Error(`Ja existe um manifesto em ${MANIFEST_PATH}. Use --prepare --replace para substitui-lo explicitamente.`);
  }
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  printBatch(manifest);
  console.log(`Manifesto salvo em: ${MANIFEST_PATH}`);
  console.log('Nenhum embedding foi gerado e nenhuma tabela de RAG foi alterada.');
}

async function loadAndValidateManifest(): Promise<BatchManifest> {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as BatchManifest;
  if (manifest.version !== 2 || manifest.uf !== UF || manifest.limit !== BATCH_SIZE
      || manifest.groups.length !== BATCH_SIZE
      || !manifest.related || !manifest.counts
      || REQUIRED_ACRONYMS.some(acronym => !manifest.requiredAcronyms.includes(acronym))) {
    throw new Error('Manifesto invalido: esperado lote v2 com 50 grupos da Bahia e IDs das entidades relacionadas.');
  }
  if (new Set(manifest.groups.map(group => group.id)).size !== BATCH_SIZE) {
    throw new Error('Manifesto invalido: ha IDs de grupo duplicados.');
  }

  for (const acronym of REQUIRED_ACRONYMS) {
    const matches = manifest.groups.filter(group => hasAcronym(group.nome, acronym));
    if (matches.length !== 1) {
      throw new Error(`Manifesto invalido: ${acronym} aparece em ${matches.length} grupos; esperado exatamente um.`);
    }
  }
  const expectedCounts = {
    groups: manifest.groups.length,
    researchers: manifest.related.researcherIds.length,
    lines: manifest.related.lineIds.length,
    sectors: manifest.related.sectorIds.length,
    productions: manifest.related.productionIds.length,
  };
  if (Object.entries(expectedCounts).some(([key, count]) => manifest.counts[key as keyof typeof expectedCounts] !== count)) {
    throw new Error('Manifesto invalido: contagens nao correspondem às listas de IDs.');
  }
  return manifest;
}

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

function buildGroupContent(grupo: any): string {
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

function buildResearcherContent(pesquisador: any): string {
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

function buildLineContent(linha: any): string {
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

function buildProductionContent(producao: any): string {
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

function requireRelatedConfirmation(manifest: BatchManifest): void {
  const relatedDocumentCount = manifest.related.researcherIds.length
    + manifest.related.lineIds.length
    + manifest.related.productionIds.length;
  const args = process.argv.slice(2);
  const confirmationIndex = args.indexOf('--confirm-related');
  if (confirmationIndex < 0 || args[confirmationIndex + 1] !== String(relatedDocumentCount)) {
    throw new Error(`Este manifesto inclui ${relatedDocumentCount} documentos relacionados. Para confirmar explicitamente, use --apply --confirm 50 --confirm-related ${relatedDocumentCount}.`);
  }
}

async function apply(): Promise<void> {
  if (!process.env.OPEN_AI_KEY) throw new Error('OPEN_AI_KEY nao esta configurada; lote nao iniciado.');
  const manifest = await loadAndValidateManifest();
  requireRelatedConfirmation(manifest);
  const groups = await prisma.grupoPesquisa.findMany({
    where: { id: { in: manifest.groups.map(group => group.id) } },
    include: {
      instituicoes: { include: { instituicao: { include: { estado: true } } } },
      linhasPesquisa: true,
      membros: { include: { pesquisador: true } },
      areasConhecimento: { include: { area: true } },
    },
  });
  const manifestById = new Map(manifest.groups.map(group => [group.id, group]));
  if (groups.length !== BATCH_SIZE || groups.some(group => {
    const expected = manifestById.get(group.id);
    return group.uf !== UF || !expected || group.nome !== expected.nome || group.dgpId !== expected.dgpId;
  })) {
    throw new Error('Os grupos no banco diferem do manifesto ou deixaram de pertencer a BA; nenhum embedding foi iniciado. Gere novamente o manifesto.');
  }

  const currentRelated = await collectRelatedIds(manifest.groups.map(group => group.id));
  if (!sameIds(currentRelated.researcherIds, manifest.related.researcherIds)
      || !sameIds(currentRelated.lineIds, manifest.related.lineIds)
      || !sameIds(currentRelated.sectorIds, manifest.related.sectorIds)
      || !sameIds(currentRelated.productionIds, manifest.related.productionIds)) {
    throw new Error('As entidades relacionadas mudaram desde o preparo do manifesto; nenhum embedding foi iniciado. Gere o manifesto novamente.');
  }

  const [researcherCount, lineCount, sectorCount, productionCount] = await Promise.all([
    prisma.pesquisador.count({ where: { id: { in: manifest.related.researcherIds } } }),
    prisma.linhaPesquisa.count({ where: { id: { in: manifest.related.lineIds } } }),
    prisma.setorAplicacao.count({ where: { id: { in: manifest.related.sectorIds } } }),
    prisma.producao.count({ where: { id: { in: manifest.related.productionIds } } }),
  ]);
  if (researcherCount !== manifest.counts.researchers || lineCount !== manifest.counts.lines
      || sectorCount !== manifest.counts.sectors || productionCount !== manifest.counts.productions) {
    throw new Error('Uma ou mais entidades do manifesto nao existem mais no banco; nenhum embedding foi iniciado.');
  }

  printBatch(manifest);
  const progress = await loadProgress(manifest);
  const selectedGroups = manifest.groups.map(selected => groups.find(item => item.id === selected.id)!);
  await indexWithProgress(selectedGroups, RagSourceType.GRUPO_PESQUISA, progress, 'Grupos', BATCH_SIZE, 10, async grupo => {
    await indexRagDocument(prisma, {
      sourceType: RagSourceType.GRUPO_PESQUISA,
      sourceId: grupo.id,
      title: grupo.nome,
      content: buildGroupContent(grupo),
      metadata: { dgpId: grupo.dgpId || '' },
    });
  });

  const researcherIds = new Set(progress.completed[RagSourceType.PESQUISADOR] ?? []);
  for await (const page of paginateSelectedPages(manifest.related.researcherIds, after => prisma.pesquisador.findMany({
    where: { id: { in: manifest.related.researcherIds } },
    take: PAGE_SIZE,
    ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    orderBy: { id: 'asc' },
    include: {
      membrosGrupo: { include: { grupoPesquisa: { include: { instituicoes: { include: { instituicao: true } } } } } },
      _count: { select: { producoes: true } },
      areasConhecimento: { include: { area: true } },
    },
  }))) {
    await indexWithProgress(page, RagSourceType.PESQUISADOR, progress, 'Pesquisadores', manifest.related.researcherIds.length, 25, async researcher => {
      await indexRagDocument(prisma, {
        sourceType: RagSourceType.PESQUISADOR,
        sourceId: researcher.id,
        title: researcher.nome,
        content: buildResearcherContent(researcher),
        metadata: { lattesId: researcher.lattesId || '' },
      }, { force: true });
    });
    (progress.completed[RagSourceType.PESQUISADOR] ?? []).forEach(id => researcherIds.add(id));
  }

  const lineIds = new Set(progress.completed[RagSourceType.LINHA_PESQUISA] ?? []);
  for await (const page of paginateSelectedPages(manifest.related.lineIds, after => prisma.linhaPesquisa.findMany({
    where: { id: { in: manifest.related.lineIds } },
    take: PAGE_SIZE,
    ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    orderBy: { id: 'asc' },
    include: {
      grupo: { include: { instituicoes: { include: { instituicao: true } } } },
      palavrasChave: { include: { palavraChave: true } },
      setoresAplicacao: { include: { setorAplicacao: true } },
      membros: { include: { pesquisador: true } },
    },
  }))) {
    await indexWithProgress(page, RagSourceType.LINHA_PESQUISA, progress, 'Linhas', manifest.related.lineIds.length, 25, async linha => {
      await indexRagDocument(prisma, {
        sourceType: RagSourceType.LINHA_PESQUISA,
        sourceId: linha.id,
        title: linha.titulo,
        content: buildLineContent(linha),
        metadata: { grupoId: linha.grupoId },
      }, { force: true });
    });
    (progress.completed[RagSourceType.LINHA_PESQUISA] ?? []).forEach(id => lineIds.add(id));
  }

  const productionIds = new Set(progress.completed[RagSourceType.PRODUCAO] ?? []);
  for await (const page of paginateSelectedPages(manifest.related.productionIds, after => prisma.producao.findMany({
    where: { id: { in: manifest.related.productionIds } },
    take: PAGE_SIZE,
    ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    orderBy: { id: 'asc' },
    include: {
      autores: { include: { pesquisador: true } },
      palavrasChave: { include: { palavraChave: true } },
    },
  }))) {
    await indexWithProgress(page, RagSourceType.PRODUCAO, progress, 'Produções', manifest.related.productionIds.length, 100, async production => {
      await indexRagDocument(prisma, {
        sourceType: RagSourceType.PRODUCAO,
        sourceId: production.id,
        title: production.titulo,
        content: buildProductionContent(production),
        metadata: { doi: production.doi || '' },
      }, { force: true });
    });
    (progress.completed[RagSourceType.PRODUCAO] ?? []).forEach(id => productionIds.add(id));
  }

  console.log(`Lote concluido: ${BATCH_SIZE} grupos, ${researcherIds.size} pesquisadores, ${lineIds.size} linhas de pesquisa e ${productionIds.size} produções. Os ${manifest.counts.sectors} setores foram incluídos nos documentos das linhas.`);
  console.log(`Checkpoint salvo em: ${PROGRESS_PATH}`);
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  if (mode === 'help') {
    console.log([
      'Prepara ou reindexa exatamente 50 grupos com UF=BA, incluindo ACSO, G2BC e NPAI.',
      'Inclui pesquisadores e linhas associadas; produções dos pesquisadores; setores no texto das linhas.',
      '  --prepare                         Cria o manifesto expandido (sem embeddings).',
      '  --prepare --replace               Substitui explicitamente um manifesto existente.',
      '  --apply --confirm 50 --confirm-related N',
      '                                    Exige N = pesquisadores + linhas + produções do manifesto.',
      '  O progresso é salvo localmente a cada 5 documentos e retomado em nova execução.',
    ].join('\n'));
    return;
  }
  if (mode === 'prepare') await prepare();
  else await apply();
}

main()
  .catch(error => {
    console.error('Falha no lote de validacao de grupos:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
