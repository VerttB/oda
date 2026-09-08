import { access, mkdir, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { PrismaClient, prismaConfig } from '../shared/database/dist/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetDir = path.join(rootDir, 'apps', 'api', 'static', 'instituicoes');
async function pathExists(targetPath) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function getLogoInstituicao(nomeInstituicao) {
  const baseUrl = 'https://pt.wikipedia.org/api/rest_v1';
  const url = `${baseUrl}/page/summary/${encodeURIComponent(nomeInstituicao)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TCC-DGP-CNPq-API/1.0 (alyssonoliveira456@gmail.com)',
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const imageUrl = data.originalimage?.source || data.thumbnail?.source || null;
  return imageUrl?.replace(/^http:\/\//i, 'https://') || null;
}

async function downloadImage(imageUrl, targetPath) {
  const response = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'TCC-DGP-CNPq-API/1.0 (alysson.oliveira@uneb.br)',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar imagem: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(targetPath, buffer);
}

async function main() {
  const prisma = new PrismaClient(prismaConfig);

  let baixadas = 0;
  let ignoradas = 0;
  let falhas = 0;

  try {
    await mkdir(targetDir, { recursive: true });
    const instituicoes = await prisma.instituicao.findMany({
      select: { id: true, nome: true, sigla: true },
      orderBy: { nome: 'asc' },
    });

    for (const instituicao of instituicoes) {
      const nomeArquivo = slugify(instituicao.nome) || instituicao.id;

      try {
        const logoUrl = await getLogoInstituicao(instituicao.nome);
        if (!logoUrl) {
          console.log(`Logo nao encontrado: ${instituicao.nome}`);
          ignoradas += 1;
          continue;
        }

        const urlSemPdf = logoUrl.replace(/\/pdf(?=($|\?))/i, '');
        const ext = path.extname(new URL(urlSemPdf).pathname) || '.jpg';
        const arquivo = `${nomeArquivo}-${instituicao.id.slice(0, 8)}${ext}`;
        const destino = path.join(targetDir, arquivo);

        if (await pathExists(destino)) {
          console.log(`Pulando imagem ja existente: ${arquivo}`);
          ignoradas += 1;
          continue;
        }

        await downloadImage(urlSemPdf, destino);
        baixadas += 1;
        console.log(`Baixada: ${instituicao.nome} -> ${arquivo}`);
      } catch (error) {
        falhas += 1;
        console.error(`Falha na instituicao ${instituicao.nome}:`, error.message);
      }
    }

    console.log(`Concluido. Instituicoes: ${instituicoes.length}. Logos baixados: ${baixadas}. Ignorados: ${ignoradas}. Falhas: ${falhas}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Erro ao baixar logos das instituicoes:', error);
  process.exitCode = 1;
});
