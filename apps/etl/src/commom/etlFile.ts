import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { getEtlDataPaths } from './config';
import type { DataScope } from '@oda/queue';

export type EtlFileKind = 'dgp' | 'lattes';

export class EtlInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EtlInputError';
    }
}

export function hashFile(filePath: string): string {
    return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function inspectEtlFile(filePath: string) {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) throw new EtlInputError(`O caminho nao aponta para um arquivo: ${filePath}`);
    return { arquivoJson: path.basename(filePath), tamanhoBytes: stats.size, hashArquivo: hashFile(filePath) };
}

export function resolveEtlFile(kind: EtlFileKind, fileName: string, scope: DataScope = 'default'): string {
    if (path.basename(fileName) !== fileName || !fileName.toLowerCase().endsWith('.json')) {
        throw new EtlInputError('Informe apenas o nome do arquivo JSON.');
    }
    const paths = getEtlDataPaths(scope);
    const rawDir = kind === 'dgp' ? paths.dgpDir : paths.lattesDir;
    const candidates = [path.join(rawDir, fileName), path.join(paths.processedDataDir, kind, fileName)];
    const found = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!found) throw new Error(`Arquivo ETL nao encontrado em raw-data nem processed-data: ${fileName}`);
    return found;
}

export function assertFileHash(filePath: string, expectedHash: string, expectedSize: number) {
    const current = inspectEtlFile(filePath);
    if (current.tamanhoBytes !== expectedSize || current.hashArquivo !== expectedHash) {
        throw new EtlInputError(`O arquivo ${current.arquivoJson} mudou depois de ser enfileirado.`);
    }
}

export function moveEtlFileToProcessed(sourcePath: string, kind: EtlFileKind, scope: DataScope = 'default'): boolean {
    const destinationDir = path.join(getEtlDataPaths(scope).processedDataDir, kind);
    fs.mkdirSync(destinationDir, { recursive: true });
    const destinationPath = path.join(destinationDir, path.basename(sourcePath));
    if (path.resolve(sourcePath) === path.resolve(destinationPath)) return false;

    if (fs.existsSync(destinationPath)) {
        if (hashFile(sourcePath) !== hashFile(destinationPath)) {
            throw new Error(`Ja existe um arquivo processado diferente em ${destinationPath}.`);
        }
        fs.unlinkSync(sourcePath);
        return true;
    }

    fs.renameSync(sourcePath, destinationPath);
    return true;
}
