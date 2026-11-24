import type { PrismaClient } from '@oda/database';
import { linkProductionOpenAlex } from './enrichment';
import { CLASSIFICATION_VERSION, normalizeDoi } from './openAlexClassification';
import type { OpenAlexEvidence } from './saveClassification';

/** Cache por currículo e reaproveitamento persistente por DOI por até 30 dias. */
export function createOpenAlexLookup(db: PrismaClient) {
    const requests = new Map<string, Promise<OpenAlexEvidence | null | undefined>>();
    return (input: string) => {
        const doi = normalizeDoi(input);
        let result = requests.get(doi);
        if (!result) {
            result = (async () => {
                const saved = await db.execucaoEnriquecimentoProducao.findFirst({
                    where: { producao: { doi: { equals: doi, mode: 'insensitive' } }, versaoMetodo: CLASSIFICATION_VERSION,
                        consultadaEm: { gte: new Date(Date.now() - 30 * 86400000) } },
                    orderBy: { consultadaEm: 'desc' }, select: { evidencia: true },
                });
                if (saved) return saved.evidencia as unknown as OpenAlexEvidence;
                return linkProductionOpenAlex(doi);
            })();
            requests.set(doi, result);
        }
        return result;
    };
}
