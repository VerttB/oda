const ACCENTED_CHARACTERS = 'áàâãäéèêëíìîïóòôõöúùûüçñýÿ';
const PLAIN_CHARACTERS = 'aaaaaeeeeiiiiooooouuuucnyy';

type SourceType = 'GRUPO_PESQUISA' | 'PESQUISADOR' | 'PRODUCAO' | 'LINHA_PESQUISA';
type AddParameter = (value: unknown) => string;

function getText(filters: Record<string, unknown>, key: string) {
  const value = filters[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getNumber(filters: Record<string, unknown>, key: string) {
  const value = filters[key];
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function getBoolean(filters: Record<string, unknown>, key: string) {
  return typeof filters[key] === 'boolean' ? filters[key] as boolean : undefined;
}

function enumValue(value: string) {
  return value.toLocaleLowerCase('en-US');
}

function contains(column: string, value: string, add: AddParameter) {
  const normalized = value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
  return `translate(lower(${column}), '${ACCENTED_CHARACTERS}', '${PLAIN_CHARACTERS}') LIKE ${add(`%${normalized}%`)}`;
}

export function buildSemanticFilterConditions(
  sourceType: SourceType,
  filters: Record<string, unknown>,
  add: AddParameter,
) {
  const conditions: string[] = [];

  if (sourceType === 'GRUPO_PESQUISA') {
    const nome = getText(filters, 'nome');
    const situacao = getText(filters, 'situacao');
    const ano = getNumber(filters, 'anoFormacao');
    const areaId = getText(filters, 'areaConhecimentoId');
    const cidade = getText(filters, 'cidade');
    const uf = getText(filters, 'uf');
    const instituicaoId = getText(filters, 'instituicaoId');
    const estadoId = getText(filters, 'estadoId');

    if (nome) conditions.push(contains('g.nome', nome, add));
    if (situacao) conditions.push(`g.situacao::text = ${add(enumValue(situacao))}`);
    if (ano !== undefined) conditions.push(`g.ano_formacao = ${add(ano)}`);
    if (areaId) conditions.push(`g.area_conhecimento_id = ${add(areaId)}`);
    if (cidade) conditions.push(contains('g.cidade', cidade, add));
    if (uf) conditions.push(`lower(g.uf) = lower(${add(uf)})`);
    if (instituicaoId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM grupo_pesquisa_instituicao gpi
        WHERE gpi.grupo_id = g.id AND gpi.tipo_relacao = 'sede'
          AND gpi.instituicao_id = ${add(instituicaoId)}
      )`);
    }
    if (estadoId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM grupo_pesquisa_instituicao gpi
        JOIN instituicao i ON i.id = gpi.instituicao_id
        WHERE gpi.grupo_id = g.id AND i.estado_id = ${add(estadoId)}
      )`);
    }
    if (filters.simcc === true) {
      const siglas = Array.isArray(filters.simccSiglas)
        ? filters.simccSiglas.filter((value): value is string => typeof value === 'string')
        : [];
      conditions.push(`EXISTS (
        SELECT 1 FROM grupo_pesquisa_instituicao gpi
        JOIN instituicao i ON i.id = gpi.instituicao_id
        WHERE gpi.grupo_id = g.id AND gpi.tipo_relacao = 'sede'
          AND (i.sigla = ANY(${add(siglas)}::text[])
            OR i.sigla LIKE 'IFBA - %'
            OR (i.sigla = 'FIOCRUZ' AND i.nome ILIKE '%Moniz%'))
      )`);
    }
  }

  if (sourceType === 'PESQUISADOR') {
    const nome = getText(filters, 'nome');
    const formacao = getText(filters, 'formacaoAcademica');
    const tipo = getText(filters, 'tipo');
    const lattesId = getText(filters, 'lattesId');
    const orcidId = getText(filters, 'orcidId');
    const grupoId = getText(filters, 'grupoPesquisaId');
    const eLider = getBoolean(filters, 'eLider');

    if (nome) {
      for (const term of new Set(nome.split(/\s+/u))) {
        conditions.push(contains('p.nome', term.replace(/[\\%_]/g, '\\$&'), add));
      }
    }
    if (formacao) conditions.push(`p.formacao_academica::text = ${add(enumValue(formacao))}`);
    if (tipo) conditions.push(`p.tipo::text = ${add(enumValue(tipo))}`);
    if (lattesId) conditions.push(`p.lattes_id = ${add(lattesId)}`);
    if (orcidId) conditions.push(`p.orcid_id = ${add(orcidId)}`);
    if (grupoId || eLider !== undefined) {
      const memberConditions = [`mg.pesquisador_id = p.id`];
      if (grupoId) memberConditions.push(`mg.grupo_id = ${add(grupoId)}`);
      if (eLider !== undefined) memberConditions.push(`mg.e_lider = ${add(eLider)}`);
      conditions.push(`EXISTS (
        SELECT 1 FROM membro_grupo mg WHERE ${memberConditions.join(' AND ')}
      )`);
    }
  }

  if (sourceType === 'LINHA_PESQUISA') {
    const nome = getText(filters, 'nome');
    const grupoId = getText(filters, 'grupo');
    if (nome) conditions.push(contains('lp.titulo', nome, add));
    if (grupoId) conditions.push(`lp.grupo_id = ${add(grupoId)}`);
  }

  if (sourceType === 'PRODUCAO') {
    const titulo = getText(filters, 'titulo');
    const ano = getNumber(filters, 'ano');
    const tipo = getText(filters, 'tipo');
    const qualis = getText(filters, 'qualis');
    const issn = getText(filters, 'issn');
    const pesquisadorId = getText(filters, 'pesquisadorId');
    const grupoId = getText(filters, 'grupoId');

    if (titulo) conditions.push(contains('pr.titulo', titulo, add));
    if (ano !== undefined) conditions.push(`pr.ano = ${add(ano)}`);
    if (tipo) {
      const dbType = tipo === 'LIVROCAPITULO' ? 'livro_capitulo' : enumValue(tipo);
      conditions.push(`pr.tipo::text = ${add(dbType)}`);
    }
    if (qualis) conditions.push(`pr.qualis::text = ${add(qualis)}`);
    if (issn) {
      conditions.push(`regexp_replace(upper(pr.issn), '-', '', 'g') = regexp_replace(upper(${add(issn)}), '-', '', 'g')`);
    }
    if (pesquisadorId || grupoId) {
      const authorConditions = [`pp.producao_id = pr.id`];
      if (pesquisadorId) authorConditions.push(`pp.pesquisador_id = ${add(pesquisadorId)}`);
      if (grupoId) {
        authorConditions.push(`EXISTS (
          SELECT 1 FROM membro_grupo mg
          WHERE mg.pesquisador_id = pp.pesquisador_id AND mg.grupo_id = ${add(grupoId)}
        )`);
      }
      conditions.push(`EXISTS (
        SELECT 1 FROM producao_pesquisador pp WHERE ${authorConditions.join(' AND ')}
      )`);
    }
  }

  return conditions;
}
