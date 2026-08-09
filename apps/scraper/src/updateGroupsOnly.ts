import * as fs from 'fs';
import * as path from 'path';
import { DGPExtractor } from './parsers/dgpParser';

const extractor = new DGPExtractor();

async function updateExistingGroupsOnly() {
  console.log('🚀 Iniciando atualização rápida dos Grupos de Pesquisa (sem alterar Lattes)...');

  const rootDir = path.resolve(__dirname, '..');
  const candidateDirs = [
    path.join(rootDir, 'data/processed-data/dgp'),
    path.join(rootDir, 'data/raw-data/dgp'),
  ];

  let targetDir = candidateDirs.find(d => fs.existsSync(d) && fs.readdirSync(d).filter(f => f.endsWith('.json')).length > 0);

  if (!targetDir) {
    console.error(`❌ Nenhuma pasta com arquivos JSON de grupos foi encontrada em: ${candidateDirs.join(', ')}`);
    return;
  }

  const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.json'));
  console.log(`📦 Encontrados ${files.length} arquivos JSON em: ${targetDir}`);

  let updatedCount = 0;

  for (const file of files) {
    const dgpId = file.replace('.json', '');
    const url = `http://dgp.cnpq.br/dgp/espelhogrupo/${dgpId}`;

    try {
      console.log(`[${updatedCount + 1}/${files.length}] 📡 Atualizando espelho do Grupo ID: ${dgpId}...`);
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`⚠️ Não foi possível carregar URL do grupo ${dgpId}: HTTP ${res.status}`);
        continue;
      }

      const html = await res.text();
      
      const existingRaw = fs.readFileSync(path.join(targetDir, file), 'utf-8');
      const existingData = JSON.parse(existingRaw);

      const data = extractor.extractGroupMirror(html, [], new Map());
      data.id_dgp = dgpId;

      if (existingData.linhas && Array.isArray(existingData.linhas) && existingData.linhas.length > 0) {
        data.linhas = existingData.linhas;
      }

      const targetPath = path.join(targetDir, file);
      fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8');
      updatedCount++;
    } catch (err: any) {
      console.error(`❌ Erro ao atualizar grupo ${dgpId}: ${err.message}`);
    }
  }

  console.log(`\n✅ Atualização dos JSONs concluída! ${updatedCount} arquivos foram atualizados com contatos, endereço e líderes.`);
}

updateExistingGroupsOnly().catch(console.error);
