# Instruções de trabalho no ODA

Estas instruções valem para todo o repositório. Pedidos explícitos do usuário têm precedência. O planejamento e o andamento das entregas ficam em `docs/planejamento-v1.md`; este arquivo guarda orientações permanentes.

## Comunicação e autorização

- Responda em português e explique o problema, a mudança proposta e como será verificada. O usuário quer aprender enquanto o projeto evolui.
- Antes de implementar uma nova etapa, apresente seu escopo e peça autorização quando ela ainda não tiver sido concedida. Uma aprovação já dada vale para os passos necessários daquela etapa; não repita a mesma pergunta a cada arquivo ou comando.
- Pedidos de análise ou planejamento não autorizam automaticamente alterações funcionais. Pedidos explícitos de criação ou correção autorizam o trabalho indicado, respeitando os cuidados com dados e produção abaixo.
- Trabalhe em etapas pequenas e revisáveis. Ao terminar, informe arquivos alterados, comportamento resultante, validações executadas e limitações. Mostre a diff quando solicitada.
- Separe fatos observados, hipóteses e propostas. Não declare um teste como aprovado se ele não foi executado ou se o ambiente impediu sua conclusão.
- Prefira soluções simples e aproveite o código existente. Explique abstrações, dependências e infraestrutura novas antes de introduzi-las.

## Repositório e alterações existentes

- Leia as instruções aplicáveis, os arquivos envolvidos e o estado do Git antes de editar. Não reverta, sobrescreva nem inclua em commits alterações alheias ao escopo.
- Use `rg` para localizar arquivos e referências. Consulte os `package.json` para confirmar comandos; não invente scripts nem assuma que um comando antigo continua disponível.
- Use pnpm e os pacotes do workspace. Não introduza outro gerenciador de dependências.
- Não edite manualmente `dist/`, clientes Prisma gerados ou arquivos de dependências. Corrija a origem e gere os artefatos pelo fluxo do projeto.
- Não faça commit ou push sem solicitação. Quando solicitado, use mensagens em português e confira a diff que será incluída.
- `docs/` está ignorado pelo Git por decisão do usuário, mas alguns documentos antigos já são rastreados e suas alterações continuam aparecendo na diff. Não remova a regra, force inclusão nem envie documentação em commits/pushes sem autorização específica. Documentos locais podem ser atualizados normalmente.
- Não troque a branch nem altere a base de execução de um scraper em andamento sem combinar o impacto. Prefira um checkout isolado quando necessário e autorizado.

## Organização do projeto

| Caminho | Responsabilidade |
| --- | --- |
| `apps/api` | API NestJS, autenticação, consultas, métricas e administração das filas |
| `apps/web` | Frontend React com TanStack |
| `apps/scraper` | Descoberta, DGP, Lattes e seus workers |
| `apps/etl` | Transformação, enriquecimento e persistência dos dados coletados |
| `apps/system-worker` | Agendamentos e manutenção |
| `apps/langchain-ts` | Embeddings, busca semântica e RAG |
| `shared/database` | Schema, migrations e acesso ao PostgreSQL |
| `shared/shared-types` | Contratos compartilhados, tipos e schemas Zod |
| `shared/queue` | Contratos e configuração compartilhada do BullMQ |
| `scripts` | Ferramentas operacionais e tarefas pontuais |

## Banco e preservação dos dados

- Identifique se o destino é local, teste ou produção antes de qualquer operação que escreva no banco. Não exponha credenciais ao mostrar essa identificação.
- Alterações de schema, backfills, exclusões e manutenção em produção precisam de um plano concreto e de autorização para esse ambiente. Um teste local não autoriza execução no servidor.
- Para mudanças estruturais ou correções em massa, prepare backup, procedimento de restauração, estimativa de impacto e verificações antes/depois. Faça a restauração de teste em um destino isolado.
- Prefira a sequência: adicionar estrutura compatível, adaptar escrita/leitura, migrar dados, conferir contagens e relações e, por último, retirar a estrutura antiga.
- Não execute `db push`, `migrate reset`, `--accept-data-loss`, limpeza de volumes ou restauração sobre um banco existente como atalho para resolver falhas.
- O projeto tem histórico de `db push` e também migrations. Verifique o estado real do banco e o histórico antes de escolher o procedimento; não presuma que uma migration de desenvolvimento é adequada para produção.
- Índices por expressão e outros objetos SQL exigem um procedimento versionado compatível com o Prisma. Não prometa que `db push` irá gerenciá-los corretamente.
- Scripts de correção devem identificar o alvo, permitir conferência sem escrita quando viável e registrar quantidades alteradas. Devem ser seguros para reexecução ou informar claramente suas restrições.
- Não transforme semelhança de nomes ou títulos em identidade garantida. Preserve a prioridade dos identificadores confiáveis e trate ambiguidades e conflitos.

## API, contratos e acesso

- Mantenha schemas e tipos reutilizáveis em `shared/shared-types`, com Zod. Aproveite a integração existente com `nestjs-zod`, validação, serialização e OpenAPI, evitando DTOs que dupliquem contratos manualmente.
- Mudanças em rotas, filtros, paginação e respostas devem considerar clientes antigos. Aliases devem compartilhar a implementação e a política de acesso da rota principal.
- Preserve a política acordada de IA: visitantes têm duas requisições por minuto; administradores autenticados não têm esse limite por enquanto. Não permita contornar a cota alternando aliases.
- A classificação de uma rota como IA precisa acontecer a tempo de ser reconhecida pelos guards. Não dependa apenas de um parâmetro que uma rota de compatibilidade possa omitir.
- Não exponha controles internos de modelo, prompt de sistema ou temperatura nas interfaces públicas sem decisão explícita.
- Falhas no Redis não devem indisponibilizar consultas públicas independentes de Redis. Recursos que dependem dele precisam responder de forma clara, sem liberar uso ilimitado silenciosamente.
- Faça filtros, contagem, ordenação e paginação de forma coerente. Evite carregar todos os IDs ou todas as páginas para filtrar depois. Mudanças em limites já publicados precisam de análise de compatibilidade.
- Não exponha tabelas intermediárias desnecessariamente nem reintroduza `criadoEm` e `atualizadoEm` nas respostas públicas sem uma necessidade discutida.
- SQL deve usar parâmetros. Termos de busca e nomes de ordenação fornecidos pelo cliente não podem ser interpolados como SQL livre.

## Scraping, filas e ETL

- Preserve os identificadores confiáveis da fila. No DGP, o `idDgp` da fila é a referência; um espelho inválido não deve ser salvo como coleta bem-sucedida.
- Não omita silenciosamente membros, linhas ou instituições com erro. Registre falha, progresso e tentativas de forma compatível com o estado real da coleta.
- Conclua o item somente quando todo o trabalho exigido para ele terminar. Falhas ou interrupções devem permitir recuperação sem falso sucesso.
- Considere que jobs podem ser reexecutados. As operações precisam ser idempotentes; deduplicar o enqueue não garante execução única dos efeitos no banco.
- Mantenha a relação entre job, pipeline, item e identificador de origem nos logs, sem duplicar pipelines por item quando a execução representa um lote.
- Respeite os limites do CNPq considerando a origem e o IP de saída. Não crie filas por estado para multiplicar requisições e contornar esses limites.
- Preserve o isolamento entre escopos geral e SIMCC. Redis transporta jobs, não os arquivos JSON nem as imagens locais de cada servidor.
- Faça requisições externas antes de abrir transações de persistência. Mantenha transações curtas e lotes controlados; não aumente concorrência ou tamanho de lote sem medir o efeito.
- Feche páginas, contextos e processos nos caminhos de sucesso e erro. Aumentar o heap não substitui investigar retenção de memória.
- Mantenha as taxonomias CNPq e OpenAlex separadas, com relações explícitas. Não trate uma inferência como classificação oficial.
- Produção de um membro não implica automaticamente produção do grupo. Relações inferidas precisam ter um significado documentado.

## Desempenho e validação

- Meça antes e depois, com dados e condições comparáveis. Diferencie tempo de consulta, tempo total do ETL, uso de CPU, memória e espera por serviços externos.
- `EXPLAIN` mostra estimativas; seu custo não está em milissegundos. `EXPLAIN ANALYZE` executa a consulta e deve ser usado em um ambiente e uma janela apropriados.
- Um snapshot de `pg_stat_activity` não representa a duração final nem o custo acumulado. Contadores de rede e disco de containers também podem ser acumulados desde a inicialização.
- Confirme quais consultas utilizam os índices propostos. Não adicione índices, views ou cache apenas para mascarar uma consulta inadequada.
- Teste a lógica modificada e os contratos afetados. Testes com mocks não demonstram desempenho de PostgreSQL ou recuperação real de workers.
- Consulte os scripts antes de executá-los: alguns comandos de lint/format alteram arquivos. Não reformate o repositório inteiro como parte de uma correção localizada.
- Para alterações somente documentais, confira coerência, links e diff; não é necessário iniciar scrapers, rebuildar containers ou rodar a suíte inteira.

## Frontend e operação distribuída

- Use contratos e dados reais da API. Não apresente estados de sucesso, saúde do sistema, situação de grupos ou comandos executados a partir de valores fictícios.
- Fixtures e demonstrações devem ser claramente separadas da experiência de produção. Não anuncie uma ação administrativa como concluída apenas porque o botão foi acionado.
- Reutilize os componentes existentes, mantenha filtros compartilháveis pela URL e trate carregamento, ausência de resultados, falhas e limite de requisições.
- Preserve a relevância da busca semântica; um filtro textual adicional no navegador pode remover resultados semanticamente válidos.
- Profiles do Compose selecionam serviços no host atual. Não sincronizam arquivos nem coordenam automaticamente vários servidores.
- Mantenha PostgreSQL e Redis centrais na topologia acordada e cada ETL junto aos arquivos que ele processa. Confira escopo das filas e volumes antes de iniciar consumidores.
- Uma imagem Docker não contém os dados dos volumes. Documente separadamente imagens, configuração, banco, JSONs, arquivos estáticos e backups.
- Não use `docker compose down -v` em uma implantação normal. Combine reinícios, atualização de workers e mudanças de contrato para preservar jobs em andamento.
- Nunca versione `.env`, tokens, senhas ou dados pessoais desnecessários. Evite mostrá-los em logs, comandos de diagnóstico e exemplos de documentação.

## Referências locais

- Planejamento ativo: `docs/planejamento-v1.md`.
- Operação em servidores separados: `docs/docker-servidores.md`.
- Histórico do backend: `docs/backend-spec.md`; confirme o estado atual no código antes de seguir planos antigos.
- Filas: `docs/bullmq-scraper.md` e `docs/bullmq-etl.md`.

Parte dos documentos em `docs/`, incluindo o planejamento ativo, é local e pode não existir em outro checkout. Nessas condições, use o código e as instruções presentes; não invente o conteúdo ausente.
