import { createHash, randomUUID } from 'node:crypto';
import { appendFile, mkdir, open, readFile, rename, truncate, unlink, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import * as path from 'node:path';

export const fingerprint = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function saveJson(file: string, value: unknown): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

export async function readCheckpoint(file: string): Promise<Map<string, string>> {
  let raw: Buffer;
  try { raw = await readFile(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map(); throw error; }
  const completed = new Map<string, string>();
  const lines = raw.toString('utf8').split('\n');
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index]) continue;
    try {
      const entry = JSON.parse(lines[index]);
      if (typeof entry.key !== 'string' || typeof entry.hash !== 'string') throw new Error('Registro inválido.');
      completed.set(entry.key, entry.hash);
    } catch {
      if (index !== lines.length - 1) throw new Error(`Checkpoint inválido na linha ${index + 1}: ${file}`);
      await truncate(file, raw.lastIndexOf(10) + 1);
      console.warn('Último registro incompleto do checkpoint foi descartado; esse documento será repetido.');
      return completed;
    }
  }
  if (raw.length && raw[raw.length - 1] !== 10) await appendFile(file, '\n');
  return completed;
}

export async function markCompleted(file: string, key: string, hash: string): Promise<void> {
  await appendFile(file, `${JSON.stringify({ key, hash })}\n`, 'utf8');
}

export async function withRunLock<T>(directory: string, action: () => Promise<T>): Promise<T> {
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, '.reindex.lock');
  const owner = { pid: process.pid, host: hostname(), lease: randomUUID() };
  let handle;
  try { handle = await open(file, 'wx'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const previous = JSON.parse(await readFile(file, 'utf8'));
    let alive = true;
    if (previous.host === hostname() && Number.isInteger(previous.pid)) {
      try { process.kill(previous.pid, 0); }
      catch (check) { alive = (check as NodeJS.ErrnoException).code !== 'ESRCH'; }
    }
    if (alive) throw new Error(`Já existe uma execução ou lock de outro host em ${file}. Confira antes de removê-lo.`);
    await unlink(file);
    handle = await open(file, 'wx');
  }
  await handle.writeFile(JSON.stringify(owner), 'utf8');
  await handle.close();
  try { return await action(); }
  finally {
    const current = JSON.parse(await readFile(file, 'utf8'));
    if (current.lease === owner.lease) await unlink(file);
  }
}
