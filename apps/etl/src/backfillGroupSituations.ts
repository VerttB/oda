import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient, Situacao, prismaConfig } from '@oda/database';
import { mapDgpGroupSituation } from './commom/groupSituation';
import { PROCESSED_DATA_DIR, SIMCC_PROCESSED_DATA_DIR } from './commom/config';
import './queue/env';

type Scope = 'default' | 'simcc' | 'all';
type Candidate = { situacao: Situacao; files: string[] };

const prisma = new PrismaClient(prismaConfig);

function parseArgs(args: string[]) {
  let scope: Scope = 'all';
  let apply = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--apply') apply = true;
    else if (arg === '--scope') scope = args[++index] as Scope;
    else if (arg.startsWith('--scope=')) scope = arg.slice('--scope='.length) as Scope;
    else if (arg === '--help' || arg === '-h') {
      console.log('Uso: pnpm --filter @oda/etl backfill:group-situations [--scope default|simcc|all] [--apply]');
      process.exit(0);
    } else {
      throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }
  if (!['default', 'simcc', 'all'].includes(scope)) {
    throw new Error(`Escopo invalido: ${scope}. Use default, simcc ou all.`);
  }
  return { scope, apply };
}

function getDirectories(scope: Scope) {
  const directories: string[] = [];
  if (scope === 'default' || scope === 'all') directories.push(path.join(PROCESSED_DATA_DIR, 'dgp'));
  if (scope === 'simcc' || scope === 'all') directories.push(path.join(SIMCC_PROCESSED_DATA_DIR, 'dgp'));
  return directories;
}

function readCandidates(directories: string[]) {
  const candidates = new Map<string, Candidate>();
  const conflicts = new Set<string>();
  let ignored = 0;

  for (const directory of directories) {
    if (!fs.existsSync(directory)) continue;
    const files = fs.readdirSync(directory).filter(name => name.toLowerCase().endsWith('.json')).sort();
    for (const file of files) {
      const filePath = path.join(directory, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
        if (typeof data.idDgp === 'string' && /^0+$/.test(data.idDgp.trim())) {
          console.warn(`[Ignorado] ${filePath}: idDgp zerado.`);
          ignored++;
          continue;
        }

        const rawDgpId = data.id_dgp || data.idDgp || path.basename(file, '.json');
        if (typeof rawDgpId !== 'string' || !/^\d{16}$/.test(rawDgpId.trim())) {
          console.warn(`[Ignorado] ${filePath}: ID DGP ausente ou invalido.`);
          ignored++;
          continue;
        }
        const dgpId = rawDgpId.trim();

        const situacao = mapDgpGroupSituation(data.situacao);
        const previous = candidates.get(dgpId);
        if (previous && previous.situacao !== situacao) {
          conflicts.add(dgpId);
          console.warn(`[Conflito] ${dgpId}: arquivos com situacoes diferentes; nenhum sera aplicado.`);
          continue;
        }
        if (previous) previous.files.push(filePath);
        else candidates.set(dgpId, { situacao, files: [filePath] });
      } catch (error) {
        console.warn(`[Ignorado] ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        ignored++;
      }
    }
  }
  return { candidates, conflicts, ignored };
}

async function main() {
  const { scope, apply } = parseArgs(process.argv.slice(2));
  const directories = getDirectories(scope);
  const { candidates, conflicts, ignored } = readCandidates(directories);
  let updated = 0;
  let unchanged = 0;
  let missing = 0;
  let failed = 0;

  console.log(`[Backfill] Modo: ${apply ? 'APLICAR' : 'SIMULACAO'}; escopo: ${scope}.`);
  console.log(`[Backfill] Pastas processadas: ${directories.join(', ')}`);

  for (const [dgpId, candidate] of candidates) {
    if (conflicts.has(dgpId)) continue;
    try {
      const group = await prisma.grupoPesquisa.findUnique({
        where: { dgpId },
        select: { id: true, situacao: true },
      });
      if (!group) {
        console.warn(`[Sem correspondencia] Grupo DGP ${dgpId} nao existe no banco.`);
        missing++;
        continue;
      }
      if (group.situacao === candidate.situacao) {
        unchanged++;
        continue;
      }

      console.log(`[${apply ? 'Atualizando' : 'Simularia'}] ${dgpId}: ${group.situacao} -> ${candidate.situacao}`);
      if (apply) {
        await prisma.grupoPesquisa.update({
          where: { id: group.id },
          data: { situacao: candidate.situacao },
        });
      }
      updated++;
    } catch (error) {
      console.error(`[Falha] ${dgpId}: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log(`[Backfill] Candidatos: ${candidates.size}; alterados/simulados: ${updated}; ja corretos: ${unchanged}; sem grupo: ${missing}; ignorados: ${ignored}; conflitos: ${conflicts.size}; falhas: ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch(error => {
    console.error(`[Backfill] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
