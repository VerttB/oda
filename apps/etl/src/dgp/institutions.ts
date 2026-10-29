import { TipoRelacaoGrupoInstituicao } from '@oda/database';

export type GrupoInstituicaoInput = {
    nome: string;
    sigla?: string | null;
    uf?: string | null;
    tipoRelacao: TipoRelacaoGrupoInstituicao;
    unidade?: string | null;
    unidadeUf?: string | null;
};

type GrupoInstituicaoRawInput = Omit<Partial<GrupoInstituicaoInput>, 'unidade'> & {
    nome?: string | null;
    unidade?: string | { nome?: unknown; uf?: unknown } | null;
};

function cleanOptional(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    return clean.length > 0 ? clean : null;
}

function normalizeUf(value: unknown): string | null {
    const clean = cleanOptional(value);
    return clean ? clean.toUpperCase() : null;
}

function getUnidadeNome(value: unknown): string | null {
    if (typeof value === 'string') return cleanOptional(value);
    if (!value || typeof value !== 'object') return null;

    return cleanOptional((value as { nome?: unknown }).nome);
}

function getUnidadeUf(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    return normalizeUf((value as { uf?: unknown }).uf);
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitInstitutionNameAndSigla(rawName: string, fallbackSigla?: string | null) {
    const trimmedName = rawName.trim();
    const dashMatch = trimmedName.match(/\s+-\s+([A-Z0-9 .]{2,20})$/);
    const parenMatch = trimmedName.match(/\(([A-Z0-9 .]{2,20})\)$/);
    const sigla = cleanOptional(fallbackSigla) ?? dashMatch?.[1]?.trim() ?? parenMatch?.[1]?.trim() ?? null;
    const nome = sigla
        ? trimmedName
            .replace(new RegExp(`\\s+-\\s+${escapeRegex(sigla)}$`), '')
            .replace(new RegExp(`\\s*\\(${escapeRegex(sigla)}\\)$`), '')
            .trim()
        : trimmedName;

    return {
        nome: nome || trimmedName || 'Instituição Desconhecida',
        sigla: sigla || 'INST',
    };
}

function normalizeInstitutionRelation(value: unknown): TipoRelacaoGrupoInstituicao {
    return value === TipoRelacaoGrupoInstituicao.SEDE || value === 'SEDE'
        ? TipoRelacaoGrupoInstituicao.SEDE
        : TipoRelacaoGrupoInstituicao.PARCEIRA;
}


export function buildGrupoInstituicoes(data: any, filaInstituicao?: string | null): GrupoInstituicaoInput[] {
    const instituicoes = new Map<string, GrupoInstituicaoInput>();

    const addInstituicao = (input: GrupoInstituicaoRawInput) => {
        const nome = cleanOptional(input.nome);
        if (!nome) return;

        const parsed = splitInstitutionNameAndSigla(nome, input.sigla);
        const key = `${parsed.nome.toLowerCase()}|${parsed.sigla.toLowerCase()}`;
        const current = instituicoes.get(key);
        const tipoRelacao = input.tipoRelacao ?? TipoRelacaoGrupoInstituicao.PARCEIRA;
        const unidadeNome = getUnidadeNome(input.unidade);
        const unidadeUf = normalizeUf(input.unidadeUf) ?? getUnidadeUf(input.unidade);

        instituicoes.set(key, {
            nome: parsed.nome,
            sigla: parsed.sigla,
            tipoRelacao: current?.tipoRelacao === TipoRelacaoGrupoInstituicao.SEDE
                ? TipoRelacaoGrupoInstituicao.SEDE
                : tipoRelacao,
            uf: normalizeUf(input.uf) ?? current?.uf ?? null,
            unidade: unidadeNome ?? current?.unidade ?? null,
            unidadeUf: unidadeUf ?? current?.unidadeUf ?? null,
        });
    };

    addInstituicao({
        nome: data.instituicao,
        sigla: filaInstituicao,
        uf: data.endereco?.uf,
        tipoRelacao: TipoRelacaoGrupoInstituicao.SEDE,
        unidade: data.unidade,
    });

    if (Array.isArray(data.instituicoes)) {
        for (const instituicao of data.instituicoes) {
            addInstituicao({
                nome: instituicao.nome ?? instituicao.instituicao,
                sigla: instituicao.sigla,
                uf: instituicao.uf,
                tipoRelacao: normalizeInstitutionRelation(instituicao.tipoRelacao ?? instituicao.relacao),
                unidade: instituicao.unidade,
            });
        }
    }

    return Array.from(instituicoes.values());
}

export async function getOrCreateInstituicao(tx: any, input: GrupoInstituicaoInput, estadoId?: string | null) {
    let instituicao = await tx.instituicao.findFirst({
        where: { nome: { equals: input.nome, mode: 'insensitive' } }
    });

    if (!instituicao && input.sigla && input.sigla !== 'INST') {
        instituicao = await tx.instituicao.findFirst({
            where: { sigla: { equals: input.sigla, mode: 'insensitive' } }
        });
    }

    if (!instituicao) {
        instituicao = await tx.instituicao.create({
            data: {
                nome: input.nome,
                sigla: input.sigla || 'INST',
                estadoId: estadoId || null
            }
        });
    }

    return instituicao;
}

export async function getEstadoIdByUf(tx: any, uf?: string | null, fallbackEstadoId?: string | null) {
    const cleanUf = normalizeUf(uf);
    if (!cleanUf) return fallbackEstadoId ?? null;

    const estado = await tx.estado.findUnique({
        where: { sigla: cleanUf }
    });

    return estado?.id ?? fallbackEstadoId ?? null;
}
