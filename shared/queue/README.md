# @oda/queue

Contratos, conexao e configuracao BullMQ compartilhados pelo ODA. A primeira integracao real e a coleta DGP em `apps/scraper/src/queue`. Guia completo: [BullMQ no scraper](../../docs/bullmq-scraper.md).

## Coleta real

Com `REDIS_URL` e `DATABASE_URL` no `.env` apontando para os servidores remotos, compile na raiz:

```sh
pnpm queue:prepare
pnpm queue:dgp:worker
```

Em outro terminal, publique um ID real ou use `enqueue` sem IDs para selecionar ate 200 pendentes:

```sh
pnpm queue:dgp:enqueue 1234567890123456
pnpm queue:dgp:status 1234567890123456
pnpm queue:dgp:reconcile
```

O ID acima e ilustrativo. Ha quatro tentativas totais, concorrencia global 1 e um pipeline por lote publicado. Cada grupo tem um item de resultado. O worker usa um processor isolado em outro processo Node.

## Demonstracao

Com o Redis ativo, abra dois terminais na raiz do projeto.

Terminal 1:

```powershell
pnpm queue:demo:worker
```

Terminal 2:

```powershell
pnpm queue:demo:producer 1234567890123456
```

O worker deve mostrar o recebimento do job, progresso 50 e 100, e conclusão com `simulated: true`. Encerre o worker com `Ctrl+C`.

A demonstracao agora usa exclusivamente `oda-queue-demo`, separada de `oda-dgp-scraper`. Jobs antigos de demo na fila real nao possuem o contrato versionado e sao rejeitados pelo processor real.

Na fila real, `jobId` usa `dgp-{idDgp}`. Enquanto um job aguarda, processa ou repete a coleta, publicacoes duplicadas nao criam outra execucao. Sucessos ficam por ate 24 horas ou 1.000 registros, com limpeza oportunista quando outros jobs terminam. Falhas ficam disponiveis para reconciliacao; ao republicar explicitamente um ID finalizado, o historico SQL e preservado e um novo job e criado. Limpeza automatica de falhas ja conciliadas fica para a proxima etapa.

## Responsabilidades

- `contracts.ts`: nomes e formato dos jobs compartilhados entre produtor e worker.
- `connection.ts`: transforma `REDIS_URL` ou `REDIS_HOST`/`REDIS_PORT` em configuração do BullMQ.
- `queues.ts`: cria a fila e adiciona jobs.
- `demo-producer.ts`: processo curto usado para publicar um job.
- `demo-worker.ts`: processo contínuo que consome e simula o job.

O modulo compartilhado nao contem Prisma nem extracao de HTML. A publicacao, o worker e a persistencia operacional estao em `apps/scraper/src/queue`.
