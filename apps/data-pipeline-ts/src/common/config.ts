import * as path from 'path';
import * as fs from 'fs';

// Use process.cwd() to ensure paths are relative to the project root, not the file location
export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.resolve(ROOT_DIR, 'data');
export const DGP_DATA_DIR = path.join(DATA_DIR, 'dgp');
export const LATTES_DATA_DIR = path.join(DATA_DIR, 'lattes');
export const IMAGE_DIR = path.join(DATA_DIR, 'images');

[DATA_DIR, DGP_DATA_DIR, LATTES_DATA_DIR, IMAGE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

export function saveJson(data: any, dir: string, fileName: string) {
    const filePath = path.join(dir, `${fileName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
