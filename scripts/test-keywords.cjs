// Integração somente em PostgreSQL descartável. Não usa DATABASE_URL nem volumes do projeto.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const req = createRequire(path.resolve(__dirname, '../apps/api/package.json'));
const { Client } = req('pg');
const { PrismaClient } = req('@oda/database');
const { PrismaPg } = req('@prisma/adapter-pg');
const { saveClassification, classificationResponseHash } = require('../apps/etl/dist/lattes/saveClassification');
const { saveResearcherProductionsBatch } = require('../apps/etl/dist/lattes/productions');
const { createOpenAlexLookup } = require('../apps/etl/dist/lattes/openAlexLookup');
const { ProducoesService } = require('../apps/api/dist/src/resources/producoes/producoes.service');
const { PalavraChaveService } = require('../apps/api/dist/src/resources/palavra-chave/palavra-chave.service');
const { ProducaoResponseSchema, keywordSearchKey } = req('@oda/shared-types');
const { testProductionGroup } = require('../apps/api/test/production-group-postgres.cjs');
const { importReview } = require('./import-reviewed-keywords.cjs');
global.fetch = async () => { throw new Error('Requisições externas são proibidas neste teste.'); };
const name = `oda-keywords-test-${process.pid}-${randomUUID().slice(0, 8)}`;
let started = false, pg, db;
function docker(...args) {
    const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 0, r.stderr || r.stdout || String(r.error));
    return (args[0] === 'logs' ? r.stdout + r.stderr : r.stdout).trim();
}
async function main() {
    try {
        docker('run', '--rm', '-d', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
            '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=256m',
            '-p', '127.0.0.1::5432', 'pgvector/pgvector:pg17');
        started = true;
        const port = Number(docker('port', name, '5432/tcp').split(':').pop());
        let ready = false;
        for (let i = 0; i < 160; i++) {
            if (spawnSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).status === 0) { ready = true; break; }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        assert.ok(ready, 'PostgreSQL descartável não iniciou. ' + (ready ? '' : docker('logs', '--tail', '30', name)));
        const url = `postgresql://postgres@127.0.0.1:${port}/postgres`;
        pg = new Client({ connectionString: url });
        await pg.connect();
        const dir = path.resolve(__dirname, '../shared/database/prisma/migrations');
        const migrations = readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
        for (const migration of migrations.filter(m => m < '20261117120000_palavras_chave_classificacao')) {
            await pg.query(readFileSync(path.join(dir, migration, 'migration.sql'), 'utf8'));
        }
        const legacyWord = randomUUID(), production = randomUUID();
        await pg.query(`INSERT INTO palavra_chave(id,termo,termo_normalizado,atualizado_em) VALUES($1,'C++','c',now())`, [legacyWord]);
        await pg.query(`INSERT INTO producao(id,titulo,doi,tipo,atualizado_em) VALUES($1,'Programação','10.123/test','artigo',now())`, [production]);
        await pg.query('INSERT INTO producao_palavra_chave(producao_id,palavra_chave_id) VALUES($1,$2)', [production, legacyWord]);
        docker('exec', name, 'pg_dump', '-U', 'postgres', '-Fc', '-f', '/tmp/before.dump', 'postgres');
        docker('exec', name, 'createdb', '-U', 'postgres', 'restore_test');
        docker('exec', name, 'pg_restore', '-U', 'postgres', '--exit-on-error', '-d', 'restore_test', '/tmp/before.dump');
        assert.equal(docker('exec', name, 'psql', '-U', 'postgres', '-d', 'restore_test', '-Atc', 'SELECT count(*) FROM producao_palavra_chave'), '1');
        console.log('PASS backup e restauração da base anterior em destino isolado');
        await pg.query(readFileSync(path.join(dir, '20261117120000_palavras_chave_classificacao/migration.sql'), 'utf8'));
        await pg.query(readFileSync(path.join(dir, '20261124120000_revisao_producao_grupo/migration.sql'), 'utf8'));
        db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
        assert.equal((await db.palavraChave.findUniqueOrThrow({ where: { id: legacyWord } })).origem, 'LEGADO_NAO_INFORMADO');
        assert.equal(await db.producaoPalavraChave.count(), 1);
        console.log('PASS migração preserva IDs, termos e relações legadas');

        const area = await db.openAlexAreaConhecimento.create({ data: { termo: 'Database', termoNormalizado: 'database', externalId: 'T1', tipo: 'TOPIC' } });
        const cnpq = await db.areaConhecimento.create({ data: { nome: 'Computação', nomeNormalizado: 'computacao' } });
        const forbidden = await db.areaConhecimento.create({ data: { nome: 'Área não equivalente', nomeNormalizado: 'outra' } });
        const rejected = await db.areaConhecimento.create({ data: { nome: 'Mapeamento rejeitado', nomeNormalizado: 'rejeitado' } });
        await db.mapeamentoAreaTaxonomia.createMany({ data: [
            { openAlexAreaId: area.id, areaConhecimentoId: cnpq.id, metodo: 'MANUAL', status: 'APROVADO', tipoRelacao: 'OPENALEX_MAIS_ESPECIFICO' },
            { openAlexAreaId: area.id, areaConhecimentoId: forbidden.id, metodo: 'MANUAL', status: 'APROVADO', tipoRelacao: 'OPENALEX_MAIS_AMPLO' },
            { openAlexAreaId: area.id, areaConhecimentoId: rejected.id, metodo: 'MANUAL', status: 'REJEITADO', tipoRelacao: 'EQUIVALENTE' },
        ] });
        const evidence = { abstract: 'Resumo', publicationYear: 2026, issn: '12345678', consultadaEm: new Date().toISOString(), classification: {
            obraId: 'https://openalex.org/W1',
            keywords: [{ id: 'https://openalex.org/keywords/cpp', nome: 'C++', score: 0.4 }],
            topics: [{ id: 'https://openalex.org/T1', nome: 'Database', score: 0.8, principal: true }],
        } };
        await db.$transaction(tx => saveClassification(tx, production, '10.123/test', evidence));
        await db.$transaction(tx => saveClassification(tx, production, '10.123/test', evidence));
        assert.equal(await db.execucaoEnriquecimentoProducao.count(), 1);
        const word = await db.palavraChave.findFirstOrThrow({ where: { origem: 'OPENALEX' } });
        assert.notEqual(word.id, legacyWord);
        const relation = await db.producaoPalavraChave.findUniqueOrThrow({ where: { producaoId_palavraChaveId: { producaoId: production, palavraChaveId: word.id } } });
        assert.equal(relation.scoreOriginal, 0.4);
        assert.equal(await db.producaoAreaConhecimento.count({ where: { areaConhecimentoId: cnpq.id } }), 1);
        assert.equal(await db.producaoAreaConhecimento.count({ where: { areaConhecimentoId: forbidden.id } }), 0);
        assert.equal(await db.producaoAreaConhecimento.count({ where: { areaConhecimentoId: rejected.id } }), 0);
        assert.equal((await createOpenAlexLookup(db)('10.123/test')).classification.obraId, evidence.classification.obraId);
        const cachedEvidence = await createOpenAlexLookup(db)('10.123/test');
        await db.$transaction(tx => saveClassification(tx, production, '10.123/test', cachedEvidence));
        assert.equal(await db.execucaoEnriquecimentoProducao.count(), 1);
        console.log('PASS reexecução idempotente, cache persistente, score baixo e direção do mapeamento');

        const topicKey = { producaoId_openAlexAreaId: { producaoId: production, openAlexAreaId: area.id } };
        await db.producaoOpenAlexArea.update({ where: topicKey, data: { revisao: 'REJEITADO' } });
        await db.$transaction(tx => saveClassification(tx, production, '10.123/test', evidence));
        assert.equal(await db.producaoAreaConhecimento.count(), 0);
        assert.equal((await db.producaoOpenAlexArea.findUniqueOrThrow({ where: topicKey })).revisao, 'REJEITADO');
        await db.producaoOpenAlexArea.update({ where: topicKey, data: { revisao: 'PENDENTE' } });
        await db.$transaction(tx => saveClassification(tx, production, '10.123/test', evidence));
        assert.equal(await db.producaoAreaConhecimento.count(), 1);
        console.log('PASS tópico rejeitado não gera área CNPq nem perde a decisão humana');

        const cnpqKey = { producaoId_areaConhecimentoId: { producaoId: production, areaConhecimentoId: cnpq.id } };
        await db.producaoAreaConhecimento.update({ where: cnpqKey, data: { revisao: 'REJEITADO' } });
        await db.$transaction(tx => saveClassification(tx, production, '10.123/test', evidence));
        assert.equal((await db.producaoAreaConhecimento.findUniqueOrThrow({ where: cnpqKey })).revisao, 'REJEITADO');
        await db.producaoAreaConhecimento.update({ where: cnpqKey, data: { revisao: 'PENDENTE' } });
        await assert.rejects(db.producaoPalavraChave.update({ where: {
            producaoId_palavraChaveId: { producaoId: production, palavraChaveId: word.id },
        }, data: { scoreOriginal: 1.4 } }));
        console.log('PASS rejeição CNPq preservada e constraint de score aplicada pelo PostgreSQL');

        await db.producaoPalavraChave.update({ where: { producaoId_palavraChaveId: { producaoId: production, palavraChaveId: word.id } }, data: { revisao: 'REJEITADO' } });
        await db.palavraChave.update({ where: { id: word.id }, data: { termo: 'Tradução revisada', traducaoStatus: 'REVISADA' } });
        const newer = { ...evidence, classification: { ...evidence.classification, keywords: [{ ...evidence.classification.keywords[0], score: 0.9 }] } };
        await db.$transaction(tx => saveClassification(tx, production, '10.123/test', newer));
        assert.equal(await db.execucaoEnriquecimentoProducao.count(), 2);
        assert.equal((await db.producaoPalavraChave.findUniqueOrThrow({ where: { producaoId_palavraChaveId: { producaoId: production, palavraChaveId: word.id } } })).scoreOriginal, 0.4);
        assert.equal((await db.palavraChave.findUniqueOrThrow({ where: { id: word.id } })).termo, 'Tradução revisada');
        console.log('PASS histórico e decisões/traduções revisadas preservados');

        await db.producaoOpenAlexArea.update({ where: { producaoId_openAlexAreaId: { producaoId: production, openAlexAreaId: area.id } }, data: { revisao: 'CONFIRMADO' } });
        const empty = { ...evidence, classification: { ...evidence.classification, keywords: [], topics: [] } };
        await db.$transaction(tx => saveClassification(tx, production, '10.123/test', empty));
        assert.equal(await db.producaoOpenAlexArea.count(), 1);
        assert.equal(await db.producaoAreaConhecimento.count(), 0);
        assert.equal(await db.producaoPalavraChave.count(), 2); // legado e rejeição manual
        console.log('PASS remoção de inferências pendentes obsoletas preserva confirmação e legado');

        const input = { titulo: 'Programação', ano: 2026, anoFonte: 'OPENALEX', tipo: 'ARTIGO', doi: '10.123/test',
            url: null, veiculo: null, issn: null, qualis: null, resumo: null, openAlex: evidence };
        const authors = await Promise.all(['Autor Um', 'Autor Dois'].map(nome => db.pesquisador.create({ data: { nome } })));
        await Promise.all(authors.map(author => db.$transaction(tx => saveResearcherProductionsBatch(tx, author.id, [input]), { timeout: 15000 })));
        assert.equal(await db.producao.count(), 1);
        assert.equal(await db.producaoPesquisador.count(), 2);
        const dgp1 = await db.palavraChave.create({ data: { origem: 'DGP', termo: 'C++', termoNormalizado: 'c++', chaveIdentidade: 'c++' } });
        const dgp2 = await db.palavraChave.create({ data: { origem: 'DGP', termo: 'C#', termoNormalizado: 'c#', chaveIdentidade: 'c#' } });
        assert.notEqual(dgp1.id, dgp2.id);
        console.log('PASS produção compartilhada preserva os dois autores');
        const words = [
            { id: 'https://openalex.org/keywords/data', nome: 'Data', score: 0.4 },
            { id: 'https://openalex.org/keywords/science', nome: 'Science', score: 0.3 },
        ];
        const batch = [1, 2].map(n => ({ ...input, titulo: `Obra ${n}`, doi: `10.123/obra${n}`,
            openAlex: { ...evidence, classification: { ...evidence.classification, obraId: `https://openalex.org/W${n + 10}`, keywords: n === 1 ? words : [...words].reverse() } } }));
        await Promise.all(authors.map((author, index) => db.$transaction(tx => saveResearcherProductionsBatch(tx, author.id, index ? [...batch].reverse() : batch), { timeout: 15000 })));
        assert.equal(await db.producao.count(), 3);
        assert.equal(await db.producaoPesquisador.count(), 6);
        console.log('PASS lotes concorrentes com termos compartilhados e ordens diferentes');
        const unknown = { ...evidence, classification: { ...evidence.classification,
            topics: [{ id: 'https://openalex.org/T999999', nome: 'Ausente do catálogo', score: 0, principal: true }],
        } };
        await db.$transaction(tx => saveClassification(tx, production, '10.123/test', unknown));
        const unknownRun = await db.execucaoEnriquecimentoProducao.findFirstOrThrow({
            where: { producaoId: production, hashResposta: classificationResponseHash(unknown) },
        });
        assert.equal(unknownRun.evidencia.classification.topics[0].id, 'https://openalex.org/T999999');
        assert.equal(await db.openAlexAreaConhecimento.count({ where: { externalId: 'T999999' } }), 0);
        console.log('PASS tópico ausente preservado na evidência sem inventar cadastro');

        const wordsService = new PalavraChaveService(db, { del: async () => {} });
        const manual = await wordsService.create({ termo: 'Termo anterior' });
        await wordsService.update(manual.id, { termo: 'Termo novo' });
        assert.equal((await db.palavraChave.findUniqueOrThrow({ where: { id: manual.id } })).chaveIdentidade, 'termo novo');
        const reused = await wordsService.create({ termo: 'Termo anterior' });
        assert.notEqual(manual.id, reused.id);
        await assert.rejects(wordsService.create({ termo: 'Termo novo' }), error => error.getStatus() === 409);
        console.log('PASS renomeação manual libera identidade anterior e recusa duplicação da nova');
        const readService = new ProducoesService(db, {}, { del: async () => {} });
        const response = ProducaoResponseSchema.parse(await readService.findOne(production));
        assert.ok(response.palavrasChave.length > 0);
        for (const link of response.palavrasChave) assert.deepEqual(Object.keys(link).sort(), ['palavraChaveId', 'producaoId']);
        console.log('PASS contrato público não expõe hashes, execução, revisão ou datas das palavras-chave');
        const reviewGroupId = await testProductionGroup(db, production);
        console.log('PASS revisão autenticada, evidência obrigatória, conflito concorrente, histórico e publicação revogável');
        const term = await db.palavraChave.findFirstOrThrow({ where: { externalId: 'https://openalex.org/keywords/science' } });
        const importBatch = { versao: 1, destino: 'pt-BR', termos: [
            { externalId: term.externalId, original: term.termoOriginal, termo: 'Ciência', idiomaOriginal: 'en', status: 'REVISADA' },
            { externalId: word.externalId, original: word.termoOriginal, termo: 'Não deve substituir a decisão anterior', status: 'REVISADA' },
        ] };
        const simulated = await importReview(db, importBatch, { apply: false, keywordSearchKey });
        assert.equal(simulated.planejados, 1);
        assert.equal(simulated.gravados, 0);
        assert.equal((await db.palavraChave.findUniqueOrThrow({ where: { id: term.id } })).termo, 'Science');
        const imported = await importReview(db, importBatch, { apply: true, keywordSearchKey });
        assert.equal(imported.gravados, 1);
        const translated = await db.palavraChave.findUniqueOrThrow({ where: { id: term.id } });
        assert.equal(translated.termo, 'Ciência');
        assert.equal(translated.termoNormalizado, 'ciencia');
        assert.equal(translated.termoOriginal, 'Science');
        assert.equal(translated.traducaoMetadata.tipoRevisao, 'ASSISTIDA');
        assert.equal((await importReview(db, importBatch, { apply: true, keywordSearchKey })).gravados, 0);
        console.log('PASS importação de tradução simulável, idempotente e preserva revisões anteriores');
        const rollbackDelete = new Error('ROLLBACK_DELETE_TEST');
        try {
            await db.$transaction(async tx => {
                const service = new ProducoesService({ $transaction: callback => callback(tx) }, {}, { del: async () => {} });
                await service.remove(production);
                assert.equal(await tx.producao.findUnique({ where: { id: production } }), null);
                assert.equal(await tx.execucaoEnriquecimentoProducao.count({ where: { producaoId: production } }), 0);
                assert.equal(await tx.producaoOpenAlexArea.count({ where: { producaoId: production } }), 0);
                assert.equal(await tx.producaoGrupoRevisao.count({ where: { producaoId: production, grupoId: reviewGroupId } }), 0);
                throw rollbackDelete;
            });
        } catch (error) { if (error !== rollbackDelete) throw error; }
        assert.equal(await db.producao.count(), 3);
        assert.equal(await db.producaoGrupoRevisao.count({ where: { producaoId: production, grupoId: reviewGroupId } }), 3);
        console.log('PASS exclusão da API trata todas as FKs novas; teste revertido integralmente');
    } finally {
        if (db) await db.$disconnect();
        if (pg) await pg.end();
        if (started) docker('stop', '-t', '3', name);
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
