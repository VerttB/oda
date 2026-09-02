import { constants as fsConstants } from 'node:fs';
import { access, copyFile, mkdir, readdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
]);

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(rootDir, 'apps', 'scraper', 'data', 'images');
const targetDir = path.join(rootDir, 'apps', 'api', 'static');

async function pathExists(targetPath) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function listImages(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const parentPath = entry.parentPath ?? sourceDir;
      const relativePath = path.join(
        path.relative(sourceDir, parentPath),
        entry.name,
      );
      return {
        source: path.join(dir, relativePath),
        relativePath,
      };
    })
    .filter((entry) =>
      IMAGE_EXTENSIONS.has(path.extname(entry.relativePath).toLowerCase()),
    );
}

async function moveFile(source, target) {
  await mkdir(path.dirname(target), { recursive: true });

  try {
    await rename(source, target);
  } catch (error) {
    if (error?.code !== 'EXDEV') {
      throw error;
    }

    await copyFile(source, target);
    await unlink(source);
  }
}

async function main() {
  if (!(await pathExists(sourceDir))) {
    console.log(`Pasta de origem nao encontrada: ${sourceDir}`);
    return;
  }

  await mkdir(targetDir, { recursive: true });

  const images = await listImages(sourceDir);
  let moved = 0;
  let skipped = 0;

  for (const image of images) {
    const target = path.join(targetDir, image.relativePath);

    if (await pathExists(target)) {
      skipped += 1;
      console.log(`Pulando imagem ja existente: ${image.relativePath}`);
      continue;
    }

    await moveFile(image.source, target);
    moved += 1;
    console.log(`Movida: ${image.relativePath}`);
  }

  console.log(
    `Concluido. Imagens movidas: ${moved}. Imagens ignoradas: ${skipped}.`,
  );
}

main().catch((error) => {
  console.error('Erro ao mover imagens para a pasta static da API:', error);
  process.exitCode = 1;
});
