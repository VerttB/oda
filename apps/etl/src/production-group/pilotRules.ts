import { keywordSearchKey } from '@oda/shared-types';

export type PilotLine = {
    id: string;
    titulo: string;
    objetivo: string | null;
    termos: string[];
};

export type PilotWork = {
    titulo: string;
    resumo: string | null;
    ano: number | null;
    palavras: { original: string; rotuloRevisado?: string }[];
    areas: { id: string; nome: string }[];
};

function tokens(text: string) {
    return keywordSearchKey(text).match(/[\p{L}\p{N}]+[+#]*/gu) ?? [];
}

function containsPhrase(text: string, phrase: string[]) {
    return text.includes(' ' + phrase.join(' ') + ' ');
}

function validYear(year: number | null): year is number {
    return year !== null && Number.isInteger(year) && year >= 1900 && year <= new Date().getFullYear() + 1;
}

export function evaluatePilotPair(
    work: PilotWork,
    group: { anoFormacao: number | null; areaPrincipalId: string | null; linhas: PilotLine[] },
    authorEntryYears: (number | null)[],
) {
    const title = ' ' + tokens(work.titulo).join(' ') + ' ';
    const abstract = ' ' + tokens(work.resumo ?? '').join(' ') + ' ';
    const keywords = new Set(work.palavras.flatMap(word => [word.original, word.rotuloRevisado ?? ''])
        .map(keywordSearchKey).filter(Boolean));
    const signals = group.linhas.flatMap(line => {
        const terms = [...new Map(line.termos.map(term => [keywordSearchKey(term), term])).values()];
        const matches = terms.flatMap(term => {
            const phrase = tokens(term);
            const sources: ('PALAVRA_DA_PRODUCAO' | 'TITULO' | 'RESUMO')[] = [];
            if (keywords.has(keywordSearchKey(term))) sources.push('PALAVRA_DA_PRODUCAO');
            // Expressões completas evitam sugerir afinidade só por uma palavra isolada.
            if (phrase.length >= 2 && containsPhrase(title, phrase)) sources.push('TITULO');
            if (phrase.length >= 2 && containsPhrase(abstract, phrase)) sources.push('RESUMO');
            return sources.length ? [{ termo: term, fontes: sources }] : [];
        });
        return matches.length ? [{ linhaId: line.id, titulo: line.titulo, termos: matches }] : [];
    });
    const alignedArea = work.areas.find(area => area.id === group.areaPrincipalId) ?? null;

    const flags: string[] = [];
    const datedAuthors = authorEntryYears.filter(validYear);
    if (datedAuthors.length < authorEntryYears.length) flags.push('HISTORICO_DE_VINCULO_INCOMPLETO');
    if (!validYear(group.anoFormacao)) flags.push('SEM_ANO_DE_FORMACAO');
    if (!work.resumo?.trim()) flags.push('SEM_RESUMO');
    if (!validYear(work.ano)) flags.push('SEM_ANO_DE_PUBLICACAO_VALIDO');
    const predatesGroup = validYear(work.ano) && validYear(group.anoFormacao) && work.ano < group.anoFormacao;
    const predatesAuthors = validYear(work.ano) && datedAuthors.length > 0 &&
        datedAuthors.length === authorEntryYears.length && work.ano < Math.min(...datedAuthors);
    if (predatesGroup) flags.push('ANTERIOR_A_FORMACAO_DO_GRUPO');
    if (predatesAuthors) flags.push('ANTERIOR_A_ENTRADA_DE_TODOS_OS_AUTORES_VINCULADOS');
    if (!group.linhas.length) flags.push('SEM_LINHAS_CADASTRADAS');

    let triagem: 'CONFLITO_TEMPORAL' | 'REVISAR_AFINIDADE' | 'EVIDENCIA_INSUFICIENTE' = 'EVIDENCIA_INSUFICIENTE';
    if (predatesGroup || predatesAuthors) triagem = 'CONFLITO_TEMPORAL';
    else if (signals.length) triagem = 'REVISAR_AFINIDADE';
    return { triagem, flags, areaPrincipalEmComum: alignedArea, termosEmComum: signals };
}
