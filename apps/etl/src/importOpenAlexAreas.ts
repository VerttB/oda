import * as fs from 'node:fs/promises';
import { PrismaClient, prismaConfig } from '@oda/database';
import { normalizeString } from './commom/normalize';
import { OPENALEX_AREA_LEVELS, OPENALEX_TYPE_BY_LEVEL, parseOpenAlexCatalog } from './commom/openAlexAreas';

const BATCH_SIZE = 20;

export type OpenAlexCatalogImportStats = {
    total: number;
    criadas: number;
    atualizadas: number;
};

export async function persistOpenAlexCatalog(prisma: PrismaClient, input: unknown): Promise<OpenAlexCatalogImportStats> {
    const areas = parseOpenAlexCatalog(input);
    const existing = await prisma.openAlexAreaConhecimento.findMany({
        select: { id: true, externalId: true },
    });
    const ids = new Map(existing.map(area => [area.externalId, area.id]));
    const existingExternalIds = new Set(ids.keys());
    const stats: OpenAlexCatalogImportStats = {
        total: areas.length,
        criadas: 0,
        atualizadas: 0,
    };

    for (const level of OPENALEX_AREA_LEVELS) {
        const levelAreas = areas.filter(area => area.level === level);
        for (let offset = 0; offset < levelAreas.length; offset += BATCH_SIZE) {
            const batch = levelAreas.slice(offset, offset + BATCH_SIZE);
            const saved = await prisma.$transaction(async tx => {
                const result: { externalId: string; id: string }[] = [];
                for (const area of batch) {
                    const areaPaiId = area.parentExternalId ? ids.get(area.parentExternalId) : null;
                    if (area.parentExternalId && !areaPaiId) {
                        throw new Error(`Pai ainda nao importado: ${area.parentExternalId}.`);
                    }
                    const termo = area.termo ?? area.displayName;
                    const nomesAlternativos = area.nomesAlternativosTraduzidos.length
                        ? area.nomesAlternativosTraduzidos
                        : area.alternatives;
                    const sourceData = {
                        termoEstrangeiro: area.displayName,
                        tipo: OPENALEX_TYPE_BY_LEVEL[area.level],
                        areaPaiId,
                        descricao: area.description,
                        nomesAlternativos,
                        wikidataUrl: area.wikidataUrl,
                        wikipediaUrl: area.wikipediaUrl,
                    };
                    const savedArea = await tx.openAlexAreaConhecimento.upsert({
                        where: { externalId: area.externalId },
                        create: {
                            externalId: area.externalId,
                            termo,
                            termoNormalizado: normalizeString(termo),
                            ...sourceData,
                        },
                        update: {
                            ...(area.termo ? { termo, termoNormalizado: normalizeString(termo) } : {}),
                            ...sourceData,
                        },
                        select: { id: true, externalId: true },
                    });
                    result.push(savedArea);
                    if (existingExternalIds.has(area.externalId)) {
                        stats.atualizadas++;
                    } else {
                        stats.criadas++;
                        existingExternalIds.add(area.externalId);
                    }
                }
                return result;
            }, { maxWait: 15000, timeout: 60000 });
            for (const area of saved) ids.set(area.externalId, area.id);
            console.log(`[OpenAlex] ${level}: ${offset + batch.length}/${levelAreas.length} importados.`);
        }
    }
    return stats;
}

export async function importOpenAlexAreas(filePath: string, dryRun = false): Promise<void> {
    const raw = await fs.readFile(filePath, 'utf8');
    const areas = parseOpenAlexCatalog(JSON.parse(raw.replace(/^\uFEFF/, '')));
    const counts = Object.fromEntries(OPENALEX_AREA_LEVELS.map(level => [level, areas.filter(area => area.level === level).length]));
    console.log(`[OpenAlex] Catalogo validado: ${JSON.stringify(counts)}. Arquivo: ${filePath}`);
    console.log('[OpenAlex] Amostra do catalogo:', areas.slice(0, 3).map(area => ({
        externalId: area.externalId,
        termo: area.termo ?? area.displayName,
        termoEstrangeiro: area.displayName,
        alternativas: area.nomesAlternativosTraduzidos.length ? area.nomesAlternativosTraduzidos : area.alternatives,
    })));
    if (dryRun) {
        console.log('[OpenAlex] Simulacao concluida. Nenhuma conexao ou gravacao no banco.');
        return;
    }

    const prisma = new PrismaClient(prismaConfig);
    try {
        const stats = await persistOpenAlexCatalog(prisma, areas);
        console.log(`[OpenAlex] Importacao concluida: ${stats.total} areas; ${stats.criadas} criadas; ${stats.atualizadas} atualizadas. Registros ausentes do arquivo foram preservados.`);
    } finally {
        await prisma.$disconnect();
    }
}
