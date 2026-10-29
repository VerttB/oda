import * as fs from 'fs';
import * as path from 'path';
import { Qualis } from '@oda/database';
import { DOI_URL, OPEN_ALEX_URL } from '../commom/config';
import { stripHtml } from '../commom/normalize';

export function isValidPublicationYear(value: number | null | undefined): value is number {
    const maxYear = new Date().getFullYear() + 1;
    return Number.isInteger(value) && value >= 1900 && value <= maxYear;
}

export function parsePublicationYear(value: unknown): number | null {
    if (typeof value === 'number') {
        return isValidPublicationYear(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const parsed = parseInt(value.replace(/\D/g, ''), 10);
    return isValidPublicationYear(parsed) ? parsed : null;
}

export async function getOpenAlexData(orcid: string) {
    try {
        const url = `${OPEN_ALEX_URL}?api_key=${process.env.OPEN_ALEX_KEY}&filter=orcid:${orcid}`;
        const response = await fetch(url);
        if (!response.ok || response.status === 404) {
            throw new Error(`Orcid ${orcid} não encontrado no openAlex`);
        }

        const data = await response.json();
        if (data.meta.count === 0) return null;
        const { id } = data.results[0];
        const { h_index, i10_index } = data.results[0].summary_stats;
        return { h_index, i10_index, openAlexId: id };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log(`Ocorrou um erro ao procurar dados openAlex para ${orcid} - ${error.message}`);
        }
    }
}

function restoreAbstractFromInvertedIndex(index: Record<string, number[]>): string {
    const wordsByPosition: string[] = [];

    for (const [word, positions] of Object.entries(index)) {
        for (const position of positions) {
            wordsByPosition[position] = word;
        }
    }

    return wordsByPosition.filter(Boolean).join(' ');
}

export async function linkProductionOpenAlex(doi: string) {
    try {
        const cleanDoi = doi.trim();
        const url = `https://api.openalex.org/works/doi:${encodeURIComponent(cleanDoi)}?api_key=${process.env.OPEN_ALEX_KEY}`;
        const response = await fetch(url);
        if (!response.ok || response.status === 404) {
            throw new Error('Artigo não encontrado no OpenAlex');
        }

        const data = await response.json();
        const abstract = data?.abstract
            || (data?.abstract_inverted_index ? restoreAbstractFromInvertedIndex(data.abstract_inverted_index) : '');
        const publicationYear = isValidPublicationYear(data?.publication_year)
            ? data.publication_year
            : null;
        const issn = data?.issn_1
            || data?.primary_location?.source?.issn_l
            || data?.primary_location?.source?.issn?.[0]
            || '';

        return { abstract, publicationYear, issn };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log(`Ocorrou um erro ao procurar dados OpenAlex para o doi: ${doi} - ${error.message}`);
        }
    }
}

export async function linkProductionDoi(doi: string) {
    try {
        const response = await fetch(`${DOI_URL}${doi}`);
        if (!response.ok || response.status === 404) {
            throw new Error('Artigo não encontrado na api do DOI');
        }

        const data = await response.json();
        const abstract: string = data?.abstract ? stripHtml(data.abstract) : '';
        const publisher: string = data?.publisher || '';
        const rawUrl: string = data?.link?.[0]?.URL || data?.license?.[0]?.URL || '';
        const productionUrl = rawUrl.replace(/\/pdf\/?$/i, '');
        const issn: string = data?.ISSN?.[0]
            || data?.issn?.[0]
            || data?.['issn-type']?.[0]?.value
            || '';

        return { abstract, publisher, licenseUrl: productionUrl, issn };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log(`Ocorrou um erro ao informações para o doi: ${doi} - ${error.message}`);
        }
    }
}

let qualisMap: Map<string, string> | null = null;

function loadQualisMap() {
    if (qualisMap) return qualisMap;
    qualisMap = new Map<string, string>();

    try {
        const candidatePaths = [
            path.resolve(__dirname, '../commom/qualis-capes-2017-2020.json'),
            path.resolve(__dirname, '../../src/commom/qualis-capes-2017-2020.json'),
        ];
        const filePath = candidatePaths.find((candidate) => fs.existsSync(candidate));
        if (!filePath) return qualisMap;

        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        for (const item of data) {
            if (!item.issn || !item.qualis) continue;
            const cleanIssn = item.issn.replace(/-/g, '').trim().toUpperCase();
            qualisMap.set(cleanIssn, item.qualis);
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ETL-QUALIS] Erro ao carregar arquivo de Qualis: ${message}`);
    }

    return qualisMap;
}

export async function linkProductionQualis(issn: string): Promise<Qualis | null> {
    if (!issn) return null;
    const cleanIssn = issn.replace(/-/g, '').trim().toUpperCase();
    return (loadQualisMap().get(cleanIssn) as Qualis) || null;
}
