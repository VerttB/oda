import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { prisma } from '@oda/database';

dotenv.config({ path: '../../.env' });

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DGP_DIR = path.join(DATA_DIR, 'dgp');
const LATTES_DIR = path.join(DATA_DIR, 'lattes');

// Ensure directories exist
[DGP_DIR, LATTES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

console.log('---------------------------------------------------------');
console.log('🚀 Serviço de ETL Open DGP (TypeScript)');
console.log(`📂 Monitorando: ${DATA_DIR}`);
console.log('---------------------------------------------------------');

/**
 * Lógica de persistência para Grupos de Pesquisa (DGP)
 */
async function saveGroupToDb(data: any) {
    const dgpId = data.id_dgp;
    
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Instituição
            let instName = data.instituicao || "Instituição Desconhecida";
            let instituicao = await tx.instituicao.findFirst({
                where: { nome: { contains: instName, mode: 'insensitive' } }
            });

            if (!instituicao) {
                instituicao = await tx.instituicao.create({
                    data: {
                        nome: instName,
                        sigla: instName.substring(0, 10).toUpperCase(),
                        ufId: 'BA'
                    }
                });
            }

            // 2. Grupo
            const anoStr = data.ano_formacao?.replace(/\D/g, '');
            const ano = anoStr ? parseInt(anoStr, 10) : null;

            const grupo = await tx.grupoPesquisa.upsert({
                where: { dgpId },
                update: {
                    nome: data.nome,
                    anoFormacao: ano,
                    areaPredominante: data.area || 'N/A',
                    repercussao: data.repercussao || null,
                    instituicaoId: instituicao.id,
                },
                create: {
                    dgpId,
                    nome: data.nome,
                    anoFormacao: ano,
                    areaPredominante: data.area || 'N/A',
                    repercussao: data.repercussao || null,
                    instituicaoId: instituicao.id,
                }
            });

            // 3. Membros
            for (const membro of data.membros) {
                if (!membro.nome) continue;
                
                let pesquisador = null;
                if (membro.lattes) {
                    pesquisador = await tx.pesquisador.findUnique({ where: { lattesId: membro.lattes } });
                }

                if (!pesquisador) {
                    const existing = await tx.pesquisador.findFirst({ where: { nome: membro.nome } });
                    if (existing) {
                        pesquisador = existing;
                    } else {
                        pesquisador = await tx.pesquisador.create({
                            data: {
                                nome: membro.nome,
                                lattesId: membro.lattes || null,
                                tipo: 'PESQUISADOR',
                                formacaoAcademica: 'DOUTORADO'
                            }
                        });
                    }
                }

                await tx.membroGrupo.upsert({
                    where: {
                        pesquisadorId_grupoId: {
                            pesquisadorId: pesquisador.id,
                            grupoId: grupo.id
                        }
                    },
                    update: {},
                    create: {
                        pesquisadorId: pesquisador.id,
                        grupoId: grupo.id
                    }
                });
            }

            // 4. Linhas de Pesquisa
            await tx.membroLinhaPesquisa.deleteMany({ where: { linhaPesquisa: { grupoId: grupo.id } } });
            await tx.linhaPesquisaPalavraChave.deleteMany({ where: { linhaPesquisa: { grupoId: grupo.id } } });
            await tx.linhaPesquisaSetorAplicacao.deleteMany({ where: { linhaPesquisa: { grupoId: grupo.id } } });
            await tx.linhaPesquisa.deleteMany({ where: { grupoId: grupo.id } });

            for (const linha of data.linhas) {
                if (!linha.nome) continue;
                await tx.linhaPesquisa.create({
                    data: {
                        titulo: linha.nome,
                        objetivo: linha.objetivo,
                        grupoId: grupo.id,
                    }
                });
            }
        });
        console.log(`[ETL] ✅ Grupo ${dgpId} processado.`);
    } catch (e) {
        console.error(`[ETL] ❌ Erro ao processar grupo ${dgpId}: ${e.message}`);
    }
}

/**
 * Lógica de persistência para Currículos Lattes
 */
async function saveLattesToDb(data: any) {
    try {
        await prisma.$transaction(async (tx) => {
            const pesquisador = await tx.pesquisador.findFirst({
                where: { nome: { contains: data.nome, mode: 'insensitive' } }
            });

            if (pesquisador) {
                // Atualiza o pesquisador com dados do Lattes
                await tx.pesquisador.update({
                    where: { id: pesquisador.id },
                    data: {
                        // resumo: data.resumo,
                        // orcidId: data.orcid_id,
                    }
                });
                console.log(`[ETL] ✅ Lattes de ${data.nome} atualizado.`);
            }
        });
    } catch (error) {
        console.error(`[ETL] ❌ Erro no Lattes de ${data.nome}:`, error);
    }
}

// Watcher para processamento automático
const watcher = chokidar.watch([DGP_DIR, LATTES_DIR], {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    awaitWriteFinish: true
});

watcher.on('add', (filePath) => {
    if (!filePath.endsWith('.json')) return;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
        const data = JSON.parse(content);
        if (filePath.includes('dgp')) {
            saveGroupToDb(data);
        } else if (filePath.includes('lattes')) {
            saveLattesToDb(data);
        }
    } catch (e) {
        console.error(`[ETL] Arquivo corrompido: ${filePath}`);
    }
});

console.log('[ETL] Aguardando arquivos...');
