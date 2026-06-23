import path from "node:path";
const monorepoRoot = path.resolve(__dirname, '../../../..');
export const DATA_DIR = path.resolve(monorepoRoot, 'apps/data-pipeline-ts/data');
export const DGP_DIR = path.join(DATA_DIR, 'dgp');
export const LATTES_DIR = path.join(DATA_DIR, 'lattes');
export const OPEN_ALEX_URL="https://api.openalex.org/authors"
export const ORCID_URL="https://citation.doi.org/metadata?doi="
export const DOI_URL = "https://citation.doi.org/metadata?doi="