export type OpenAlexTerm = { id: string; nome: string; score: number | null };
export type OpenAlexClassification = {
    obraId: string;
    keywords: OpenAlexTerm[];
    topics: Array<OpenAlexTerm & { principal: boolean }>;
};
export const CLASSIFICATION_VERSION = 'openalex-obra-v1';

export function normalizeDoi(doi: string): string {
    return doi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase();
}

function externalId(value: unknown, kind: 'works' | 'topics' | 'keywords'): string {
    if (typeof value !== 'string') throw new Error(`OpenAlex: ID ${kind} ausente.`);
    const suffix = value.replace(/^https?:\/\/(?:api\.)?openalex\.org\//i, '');
    if (kind === 'keywords' && /^keywords\/[a-zA-Z0-9_-]+$/.test(suffix)) return `https://openalex.org/${suffix}`;
    const short = suffix.replace(new RegExp(`^${kind}/`), '');
    if ((kind === 'works' && /^W\d+$/.test(short)) || (kind === 'topics' && /^T\d+$/.test(short))) {
        return `https://openalex.org/${short}`;
    }
    throw new Error(`OpenAlex: ID ${kind} inválido.`);
}

function terms(input: unknown, kind: 'keywords' | 'topics'): OpenAlexTerm[] {
    if (input == null) return [];
    if (!Array.isArray(input)) throw new Error(`OpenAlex: ${kind} deve ser uma lista.`);
    const result = new Map<string, OpenAlexTerm>();
    for (const item of input) {
        if (typeof item?.display_name !== 'string' || !item.display_name.trim()) throw new Error('OpenAlex: termo sem nome.');
        const score = item.score ?? null;
        if (score !== null && (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1)) {
            throw new Error('OpenAlex: score inválido.');
        }
        const id = externalId(item.id, kind);
        const previous = result.get(id);
        if (!previous || (score ?? -1) > (previous.score ?? -1)) result.set(id, { id, nome: item.display_name.trim(), score });
    }
    return [...result.values()];
}

export function parseOpenAlexClassification(data: any): OpenAlexClassification {
    const primary = data.primary_topic?.id ? externalId(data.primary_topic.id, 'topics') : null;
    const topics = terms(data.topics, 'topics');
    // A presença isolada de primary_topic também é evidência fornecida pelo provedor.
    if (primary && !topics.some(topic => topic.id === primary)) topics.push(...terms([data.primary_topic], 'topics'));
    return {
        obraId: externalId(data.id, 'works'), keywords: terms(data.keywords, 'keywords'),
        topics: topics.map(topic => ({ ...topic, principal: topic.id === primary })),
    };
}
