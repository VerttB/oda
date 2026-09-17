import path from "node:path";
import type { DataScope } from '@oda/queue';
const monorepoRoot = path.resolve(__dirname, '../../../..');
export const DATA_DIR = process.env.SCRAPER_DATA_DIR
    ? path.resolve(process.env.SCRAPER_DATA_DIR)
    : path.resolve(monorepoRoot, 'apps/scraper/data');
export const RAW_DATA_DIR = path.join(DATA_DIR, 'raw-data');
export const PROCESSED_DATA_DIR = path.join(DATA_DIR, 'processed-data');
export const DGP_DIR = path.join(RAW_DATA_DIR, 'dgp');
export const LATTES_DIR = path.join(RAW_DATA_DIR, 'lattes');
export const SIMCC_DATA_DIR = path.join(DATA_DIR, 'simcc');
export const SIMCC_RAW_DATA_DIR = path.join(SIMCC_DATA_DIR, 'raw-data');
export const SIMCC_PROCESSED_DATA_DIR = path.join(SIMCC_DATA_DIR, 'processed-data');

export function getEtlDataPaths(scope: DataScope = 'default') {
    const rawDataDir = scope === 'simcc' ? SIMCC_RAW_DATA_DIR : RAW_DATA_DIR;
    const processedDataDir = scope === 'simcc' ? SIMCC_PROCESSED_DATA_DIR : PROCESSED_DATA_DIR;
    return {
        rawDataDir,
        processedDataDir,
        dgpDir: path.join(rawDataDir, 'dgp'),
        lattesDir: path.join(rawDataDir, 'lattes'),
    };
}
export const OPEN_ALEX_URL="https://api.openalex.org/authors"
export const ORCID_URL="https://citation.doi.org/metadata?doi="
export const DOI_URL = "https://citation.doi.org/metadata?doi="
