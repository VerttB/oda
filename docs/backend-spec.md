# Backend Specification

## 1. Contexto

Este documento consolida, de forma incremental, o planejamento técnico do backend do projeto de TCC: uma API baseada em microserviços e Inteligência Artificial para extração, estruturação, disponibilização e recuperação semântica de dados de grupos de pesquisa do CNPq/DGP.

O escopo deste documento está restrito a:

- Web Scraper e pipeline de ETL.
- API REST e microservices.
- LangChain, embeddings, busca semântica e RAG.

## 2. Objetivo Técnico Inicial

Planejar uma arquitetura backend capaz de:

- Coletar dados públicos relacionados a grupos de pesquisa.
- Transformar dados não estruturados ou semi-estruturados em modelos consistentes.
- Disponibilizar dados por API REST.
- Isolar responsabilidades em serviços independentes.
- Suportar busca semântica e respostas aumentadas por recuperação de contexto.
- Servir como artefato prático alinhado aos objetivos científicos do anteprojeto.

## 3. Escopo Inicial

### 3.1 Web Scraper

O primeiro recorte do scraper será a coleta de uma amostra controlada de grupos de pesquisa registrados no DGP/CNPq, sem restringir inicialmente por instituição. O objetivo desta etapa é validar a viabilidade técnica da coleta, transformação posterior e disponibilização dos dados.

Fonte inicial:

- Páginas públicas do DGP/CNPq via web scraping.

Formato inicial de saída da coleta:

- XML coletado a partir do DGP/CNPq.
- O XML será enviado posteriormente para a etapa de ETL.

Fontes futuras previstas:

- OpenAlex.
- DOI/Crossref ou APIs relacionadas a DOI.
- ORCID, caso seja tecnicamente e metodologicamente adequado.

O scraper deverá ser tratado como serviço independente. Ele não deve concentrar a responsabilidade completa de ETL, pois a transformação e orquestração de dados serão planejadas em uma camada própria.

Acionamento inicial:

- A coleta será iniciada por agendamento, com periodicidade inicial prevista de uma vez por dia.
- A arquitetura deve permitir evolução futura para fila/job, caso seja necessário desacoplar melhor a coleta, reprocessamento ou escalabilidade.

### 3.1.1 ETL e Orquestração

O ETL será planejado como responsabilidade separada do scraper. A ferramenta escolhida é o **Apache Hop**.

Responsabilidades atuais do ETL (Apache Hop):
- `load_cnpq_xmls`: Lê e mapeia os arquivos XML gerados pelo scraper.
- `clean_research_group_data`: Padroniza nomes (caixa alta) e limpa IDs para garantir consistência antes da inserção no banco relacional.
- `clean_researchers_data`: Pipeline dedicado para padronizar e limpar dados dos pesquisadores (ex: limpar máscaras de Lattes ID e padronização nominal).
- `enrich_researcher_data` (Pipeline de Enriquecimento Futuro): Preparado para realizar chamadas REST a APIs externas (OpenAlex, ORCID, DOI) a partir do Lattes ID para complementar os dados de pesquisadores e produções.
- `main_workflow`: Workflow orquestrador que conecta sequencialmente todos os pipelines acima.

Responsabilidades esperadas:
- Limpeza de dados coletados.
- Padronização de campos.
- Normalização de entidades.
- Controle de duplicidade.
- Registro de qualidade dos dados.
- Carga no banco transacional e/ou nas tabelas de indexação semântica.

#### Gerenciamento de Variáveis no Apache Hop
Para conciliar o desenvolvimento local (Hop Desktop) com a execução em produção (Docker), o projeto adota uma estratégia híbrida:
- **Variáveis de Ambiente (Segredos):** Senhas de banco de dados e tokens de API devem ser injetados localmente via "Edit Environment Variables" no Hop Desktop ou através do `.env` do Docker Compose. **Nunca versionados.**
- **Hop Environments (Configurações):** O arquivo `config/dev-env.json` é utilizado para versionar URLs base (ex: OpenAlex) e padrões estruturais não-sensíveis (`DB_HOST` como `localhost` para dev).

### 3.2 API REST e Microservices

A API REST terá inicialmente um frontend único como consumidor principal. A arquitetura deve, no entanto, preservar princípios de interoperabilidade para que o backend possa futuramente atender portais ou aplicações externas.

Os serviços deverão ser separados de forma independente, evitando dependências diretas entre módulos. A comunicação entre serviços deve ocorrer por contratos explícitos, banco de dados compartilhado quando justificável ou mensageria/orquestração, conforme definido nas próximas etapas.

Escopo inicial da API:

- Expor dados estruturados de grupos de pesquisa.
- Expor dados estruturados de pesquisadores.
- Expor dados estruturados de produções acadêmicas.
- Permitir consulta por áreas e linhas de pesquisa.
- Servir dados para o frontend inicial.
- Encaminhar consultas semânticas ao serviço LangChain quando necessário.

### 3.3 LangChain e RAG

O serviço LangChain será responsável pela camada de busca semântica e RAG. O MVP deve responder perguntas relacionadas a áreas e linhas de pesquisa dos grupos registrados.

Exemplo de pergunta-alvo:

> Quais grupos fazem trabalhos na área de X?

A abordagem inicial considerada é usar o mesmo PostgreSQL da API, mas com tabelas separadas para RAG/embeddings. Essa decisão busca reduzir complexidade operacional sem misturar os dados transacionais principais com os dados de indexação semântica.

Ponto técnico em aberto:

- Definir como os embeddings serão gerados após inserções ou atualizações de dados no banco transacional.

## 4. Requisitos

### 4.1 Requisitos Funcionais

- RF01: O sistema deve coletar dados públicos de grupos de pesquisa a partir do DGP/CNPq.
- RF02: O sistema deve persistir dados estruturados de grupos de pesquisa em banco relacional.
- RF03: O sistema deve expor endpoints REST para consulta de grupos de pesquisa.
- RF04: O sistema deve permitir consultas por áreas de pesquisa.
- RF05: O sistema deve permitir consultas por linhas de pesquisa.
- RF06: O sistema deve oferecer busca semântica sobre áreas e linhas de pesquisa.
- RF07: O sistema deve permitir que o serviço LangChain recupere trechos relevantes para responder perguntas sobre grupos de pesquisa.
- RF08: O pipeline de dados deve registrar informações que permitam avaliar qualidade, completude e duplicidade dos dados.
- RF09: O sistema deve coletar inicialmente dados em formato XML.
- RF10: O sistema deve permitir execução agendada do scraper.
- RF11: O sistema deve persistir e expor dados de pesquisadores vinculados aos grupos de pesquisa.
- RF12: O sistema deve persistir e expor dados de produções acadêmicas relacionadas.
- RF13: O sistema deve permitir geração ou atualização de embeddings a partir de dados inseridos ou alterados no banco.

### 4.2 Requisitos Não Funcionais

- RNF01: Os serviços devem ser independentes, com possibilidade de deploy separado.
- RNF02: A falha de um serviço não deve comprometer diretamente a disponibilidade dos demais serviços.
- RNF03: A API deve ter tempo de resposta mensurável para consultas REST.
- RNF04: O scraper deve respeitar limites técnicos e éticos de coleta automatizada.
- RNF05: O sistema deve permitir medição de qualidade dos dados coletados.
- RNF06: A arquitetura deve permitir evolução incremental para novas fontes externas, como OpenAlex, DOI e ORCID.
- RNF07: Os dados transacionais e os dados de RAG devem permanecer logicamente separados, mesmo quando armazenados no mesmo PostgreSQL.

### 4.3 Regras de Negócio

- RN01: O recorte inicial não será limitado a uma instituição específica.
- RN02: A coleta inicial será feita a partir do DGP/CNPq.
- RN03: APIs externas serão adicionadas em etapas posteriores, após validação do fluxo inicial de scraping.
- RN04: O LangChain deve responder apenas com base em dados disponíveis no sistema ou contexto recuperado.
- RN05: A busca semântica inicial será limitada a temas, áreas e linhas de pesquisa dos grupos.
- RN06: O scraper deve gerar XML como artefato inicial de coleta.
- RN07: O ETL será responsável por transformar XML em dados estruturados.
- RN08: Pesquisadores e produções acadêmicas fazem parte do escopo do MVP.

## 5. Arquitetura

Arquitetura atualizada (Monorepo Híbrido):

```mermaid
flowchart LR
  FE[Frontend] --> API[NestJS API REST]
  API --> DB[(PostgreSQL)]
  API --> LC[Python LangChain Service]
  LC --> GEMINI[Google Gemini API]
  SCRAPER[Scraper Service] --> XML[(XML Output)]
  ETL[ETL/Orchestration] --> DB
  XML --> ETL
  ETL --> IDX[Indexing Trigger]
  IDX --> LC
```

Observações:
- **API REST (Node.js/NestJS):** Responsável pelo CRUD transacional, gerenciamento de usuários e orquestração de alto nível.
- **LangChain Service (Python/FastAPI):** Microserviço especializado em busca semântica e RAG. Utiliza Google Gemini (LLM e Embeddings).
- **Vetorização:** No estágio atual do MVP, utiliza vector store em memória (FAISS) alimentado por arquivos XML.

## 6.5 Estado Atual do Scraper Service (Python)

- **Linguagem:** Python.
- **Ferramentas:** Playwright (automação), BeautifulSoup4 (parsing), SQLite (controle de estado).
- **Arquitetura:** Modelo Produtor-Consumidor.
  - `discovery.py` (Sonda): Identifica IDs de grupos de pesquisa via busca parametrizada e alimenta a fila no SQLite.
  - `scraper.py` (Aspirador): Consome IDs da fila, extrai dados detalhados (incluindo membros e linhas de pesquisa) e gera arquivos XML.
  - `run.py`: Orquestrador que executa ambos os processos em paralelo.
- **Localização:** `apps/data_pipeline`.
- **Saída:** Arquivos XML estruturados na pasta `apps/data_pipeline/data`, prontos para consumo pelo ETL ou LangChain.

### 5.1 Estrutura de Monorepo

O projeto usa um monorepo npm workspace, com `package.json` na raiz e `package.json` por aplicação.

Estrutura atual:

- `package.json` na raiz de `oda`: declara `workspaces`, scripts agregados, dependências comuns do NestJS e ferramentas de desenvolvimento compartilhadas.
- `apps/api/package.json`: mantém scripts e dependências específicas da API REST, como Prisma, cache, validação e PostgreSQL.
- `apps/langchain/package.json`: mantém scripts e dependências específicas do serviço LangChain/RAG.
- `package-lock.json` canônico fica na raiz de `oda`.

Decisões:

- As versões comuns de NestJS devem ser centralizadas na raiz para evitar desalinhamento entre aplicações.
- Todos os pacotes `@nestjs/*` devem ser mantidos no `package.json` raiz.
- Dependências específicas de cada aplicação permanecem no respectivo app.
- A unificação de dependências por workspace não altera a separação lógica dos serviços: `api` e `langchain` continuam sendo aplicações executáveis separadamente.
- Os scripts da raiz devem usar `npm --workspace` para executar comandos em cada app.

## 6. Modelagem de Dados

Decisão inicial:

- Os dados principais da aplicação ficarão em tabelas transacionais.
- Os dados de RAG ficarão em tabelas separadas, ainda que no mesmo PostgreSQL.
- As tabelas de RAG devem referenciar entidades principais de forma flexível, por exemplo por `sourceType` e `sourceId`.

Entidades mínimas candidatas para o MVP:

- `GrupoPesquisa`.
- `Instituicao`.
- `LinhaPesquisa`.
- `AreaConhecimento`.
- `PalavraChave`.
- `Pesquisador`.
- `Producao`.
- `ColetaScraper`.
- `LogColeta`.
- `RagDocument`.
- `RagChunk`.

### 6.1 Foco Atual

O planejamento imediato será concentrado na definição das tabelas do banco e na construção da API REST. Scraper, ETL e LangChain serão considerados apenas como consumidores/produtores futuros dos dados, sem detalhamento operacional nesta etapa.

Pontos a definir:

- Entidades transacionais principais.
- Campos mínimos de cada entidade.
- Relacionamentos e cardinalidades.
- Tabelas auxiliares de classificação, como áreas de conhecimento e palavras-chave.
- Estratégia para entidades externas ou identificadores vindos do DGP/CNPq.
- Endpoints REST iniciais.
- Filtros, paginação, ordenação e formato de resposta.

### 6.2 Estado Atual do Schema

Tabelas/modelos atualmente presentes no schema Prisma:

- `Instituicao`.
- `Uf`.
- `GrupoPesquisa`.
- `LinhaPesquisa`.
- `Pesquisador`.
- `MembroGrupo`.
- `MembroLinhaPesquisa`.
- `AreaConhecimento`.
- `AreaAtuacao`.
- `PalavraChave`.
- `SetorAplicacao`.
- `PesquisadorAreaAtuacao`.
- `LinhaPesquisaPalavraChave`.
- `LinhaPesquisaSetorAplicacao`.
- `Producao`.
- `ProducaoPesquisador`.
- `ProducaoPalavraChave`.
- `RagDocument`.
- `RagChunk`.
- `IndexingJob`.
- `ColetaScraper`.
- `LogColetaGrupo`.

Enums atualmente presentes:

- `Situacao`.
- `TipoPesquisador`.
- `FormacaoAcademica`.
- `TipoProducao`.
- `RagSourceType`.
- `IndexingJobStatus`.
- `StatusColeta`.
- `AcaoColeta`.

Tabelas/modelos adicionados para fechar o MVP:

- `AreaConhecimento`.
- `PalavraChave`.
- `SetorAplicacao`.
- `Producao`.
- `MembroLinhaPesquisa`.
- `LinhaPesquisaPalavraChave`.
- `LinhaPesquisaSetorAplicacao`.
- `ProducaoPalavraChave`.
- `ProducaoPesquisador`.
- `RagDocument`.
- `RagChunk`.
- `IndexingJob`.

Enums adicionados:

- `TipoProducao`.
- `TipoPesquisador`.
- `FormacaoAcademica`.
- `RagSourceType`.
- `IndexingJobStatus`.

Correções e complementos aplicados:

- `GrupoPesquisa` recebeu `dgpId` para rastrear identificador externo do DGP/CNPq.
- `GrupoPesquisa` recebeu `repercussao`.
- `Pesquisador` recebeu `lattesId`.
- `Pesquisador.name` foi corrigido para `Pesquisador.nome`.
- `Pesquisador` recebeu `tipo`, com valores técnico, estudante, pesquisador e colaborador estrangeiro.
- `Pesquisador` recebeu `formacaoAcademica`, com valores graduação, especialização, mestrado e doutorado.
- `Pesquisador` não possui `email` no modelo atual.
- `Uf` foi criada como tabela própria.
- `Instituicao.uf` passou a ser uma relação opcional com `Uf`.
- `GrupoPesquisa` passou a ter vínculo opcional com `AreaConhecimento`.
- `MembroGrupo` recebeu `dataEntrada` para registrar quando o pesquisador entrou no grupo.
- `LinhaPesquisa` passou a possuir membros por meio de `MembroLinhaPesquisa`.
- `LinhaPesquisa` passou a possuir setores de aplicação por meio de `SetorAplicacao` e `LinhaPesquisaSetorAplicacao`.
- `Producao` foi modelada com vínculo N:N com `Pesquisador`.
- `GrupoPesquisa` não possui relação direta com `Producao` no modelo atual.
- `GrupoPesquisa` não possui palavras-chave no modelo atual.
- `Pesquisador` não possui palavras-chave no modelo atual.
- `PalavraChave` foi modelada como entidade reutilizável, mas associada apenas a linhas de pesquisa e produções.
- Projetos de pesquisa foram reconhecidos como possibilidade futura, mas ficaram fora do modelo atual.
- As tabelas de RAG foram separadas das tabelas transacionais.
- `IndexingJob` foi incluída para suportar geração assíncrona de embeddings após inserções ou atualizações.
- A nomenclatura mantém camelCase no Prisma Client e snake_case no banco via `@map`/`@@map`.

### 6.3 Estado Atual da API REST

Módulos REST existentes:

- `grupos-pesquisa`.
- `instituicao`.
- `linha-pesquisa`.
- `pesquisadores`.
- `producoes`.

Endpoints scaffold existentes por recurso:

- `POST /recurso`.
- `GET /recurso`.
- `GET /recurso/:id`.
- `PATCH /recurso/:id`.
- `DELETE /recurso/:id`.

Observações:

- A API compila via `npm run api:build` no workspace monorepo.
- `linha-pesquisa` possui CRUD real com transações para manter vínculos em `membro_linha_pesquisa`, `linha_pesquisa_palavra_chave` e `linha_pesquisa_setor_aplicacao`.
- `producoes` possui CRUD real com transações para manter vínculos em `producao_pesquisador` e `producao_palavra_chave`.
- `instituicao` e `pesquisadores` possuem CRUD real simples com Prisma.
- `pesquisadores.remove` remove vínculos em `membro_grupo`, `membro_linha_pesquisa` e `producao_pesquisador` antes de excluir o pesquisador.
- `grupos-pesquisa` possui `create` e `findAll` reais, mas `findOne`, `update` e `remove` ainda precisam ser finalizados.
- `uf`, `area-conhecimento`, `setor-aplicacao` e `palavra-chave` existem como services/DTOs auxiliares internos, mas ainda não estão expostos como módulos/controllers REST no `AppModule`.
- DTOs de criação foram preenchidos para os recursos existentes com `class-validator` e `class-transformer`.
- DTOs de atualização usam `PartialType` de `@nestjs/mapped-types`.
- A aplicação usa `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform`.
- Os enums usados nos DTOs devem vir do Prisma Client gerado, não de enums locais duplicados.
- Foi criado o alias TypeScript `@/*` apontando para `src/*` para reduzir imports longos.
- As rotas scaffold existentes foram ajustadas para validar `id` com `ParseUUIDPipe`, alinhadas ao uso de UUID no schema.
- Os services recebem IDs como `string`; a validação de formato UUID fica na borda HTTP, nos controllers.
- Erros conhecidos do Prisma são tratados por um exception filter global em `src/filters/prisma.exception.filter.ts`.
- O mapeamento inicial de erros Prisma para HTTP é:
  - `P2025` para `404 Not Found`.
  - `P2002` para `409 Conflict`.
  - `P2003` para `422 Unprocessable Entity`.
  - `P2014` para `422 Unprocessable Entity`.
- Cache manual com `cacheManager.wrap` é usado principalmente em listagens (`findAll`) e invalidado em operações de escrita quando implementadas.
- Ainda não há paginação, filtros, ordenação ou padronização de resposta.
- Testes unitários reais existem para `linha-pesquisa.service` e `producoes.service`, com mocks de Prisma/cache.
- Validação recente: `npm --workspace @oda/api run test -- resources/linha-pesquisa/linha-pesquisa.service.spec.ts resources/producoes/producoes.service.spec.ts --runInBand` passou com 2 suítes e 8 testes.
- A suíte completa de testes ainda precisa ser revisada e ampliada.

## 7. Diagramas

### 7.1 DER Atual

```plantuml
@startuml
hide circle
skinparam linetype ortho
skinparam classAttributeIconSize 0

entity "uf" as Uf {
  * id : uuid
  --
  * sigla : string
  * nome : string
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "instituicao" as Instituicao {
  * id : uuid
  --
  * nome : string
  * sigla : string
  uf_id : uuid
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "area_conhecimento" as AreaConhecimento {
  * id : uuid
  --
  * nome : string
  codigo : string
  nivel : int
  area_pai_id : uuid
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "grupo_pesquisa" as GrupoPesquisa {
  * id : uuid
  --
  dgp_id : string
  * nome : string
  ano_formacao : int
  * area_predominante : string
  repercussao : text
  area_conhecimento_id : uuid
  * situacao : situacao
  * instituicao_id : uuid
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "linha_pesquisa" as LinhaPesquisa {
  * id : uuid
  --
  * titulo : string
  objetivo : text
  * grupo_id : uuid
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "pesquisador" as Pesquisador {
  * id : uuid
  --
  lattes_id : string
  * nome : string
  tipo : tipo_pesquisador
  formacao_academica : formacao_academica
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "membro_grupo" as MembroGrupo {
  * id : uuid
  --
  * pesquisador_id : uuid
  * grupo_id : uuid
  data_entrada : datetime
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "membro_linha_pesquisa" as MembroLinhaPesquisa {
  * linha_pesquisa_id : uuid
  * pesquisador_id : uuid
  --
  * criado_em : datetime
}

entity "palavra_chave" as PalavraChave {
  * id : uuid
  --
  * termo : string
  * termo_normalizado : string
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "setor_aplicacao" as SetorAplicacao {
  * id : uuid
  --
  * nome : string
  * nome_normalizado : string
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "linha_pesquisa_palavra_chave" as LinhaPesquisaPalavraChave {
  * linha_pesquisa_id : uuid
  * palavra_chave_id : uuid
  --
  * criado_em : datetime
}

entity "linha_pesquisa_setor_aplicacao" as LinhaPesquisaSetorAplicacao {
  * linha_pesquisa_id : uuid
  * setor_aplicacao_id : uuid
  --
  * criado_em : datetime
}

entity "producao" as Producao {
  * id : uuid
  --
  * titulo : string
  ano : int
  * tipo : tipo_producao
  doi : string
  url : string
  veiculo : string
  resumo : text
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "producao_pesquisador" as ProducaoPesquisador {
  * producao_id : uuid
  * pesquisador_id : uuid
  --
  ordem_autoria : int
  * criado_em : datetime
}

entity "producao_palavra_chave" as ProducaoPalavraChave {
  * producao_id : uuid
  * palavra_chave_id : uuid
  --
  * criado_em : datetime
}

entity "rag_document" as RagDocument {
  * id : uuid
  --
  * source_type : rag_source_type
  * source_id : string
  titulo : string
  conteudo : text
  metadata : json
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "rag_chunk" as RagChunk {
  * id : uuid
  --
  * document_id : uuid
  * conteudo : text
  embedding : vector(1536)
  * ordem : int
  token_count : int
  metadata : json
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "indexing_job" as IndexingJob {
  * id : uuid
  --
  * source_type : rag_source_type
  * source_id : string
  * status : indexing_job_status
  erro : text
  * tentativas : int
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "coleta_scraper" as ColetaScraper {
  * id : uuid
  --
  * data_inicio : datetime
  * data_fim : datetime
  * status : status_coleta
  * registros_processados : int
  * origem : string
  * log_erros : text
  * criado_em : datetime
  * atualizado_em : datetime
}

entity "log_coleta_grupo" as LogColetaGrupo {
  * id : uuid
  --
  * coleta_id : uuid
  * grupo_id : uuid
  * acao : acao_coleta
  * criado_em : datetime
  * atualizado_em : datetime
}

Uf ||--o{ Instituicao
Instituicao ||--o{ GrupoPesquisa
AreaConhecimento ||--o{ GrupoPesquisa
AreaConhecimento ||--o{ AreaConhecimento : subareas
GrupoPesquisa ||--o{ LinhaPesquisa
GrupoPesquisa ||--o{ MembroGrupo
Pesquisador ||--o{ MembroGrupo
LinhaPesquisa ||--o{ MembroLinhaPesquisa
Pesquisador ||--o{ MembroLinhaPesquisa
LinhaPesquisa ||--o{ LinhaPesquisaPalavraChave
PalavraChave ||--o{ LinhaPesquisaPalavraChave
LinhaPesquisa ||--o{ LinhaPesquisaSetorAplicacao
SetorAplicacao ||--o{ LinhaPesquisaSetorAplicacao
Producao ||--o{ ProducaoPesquisador
Pesquisador ||--o{ ProducaoPesquisador
Producao ||--o{ ProducaoPalavraChave
PalavraChave ||--o{ ProducaoPalavraChave
RagDocument ||--o{ RagChunk
ColetaScraper ||--o{ LogColetaGrupo
GrupoPesquisa ||--o{ LogColetaGrupo
@enduml
```

## 8. Considerações Acadêmicas

Métricas iniciais consideradas para avaliação do artefato:

- Quantidade de valores nulos por entidade/campo.
- Tempo médio de resposta da API.
- Qualidade das respostas do LangChain/RAG.
- Identificação e análise de dados duplicados.
- Completude dos dados após coleta e ETL.

A avaliação inicial das respostas do LangChain será manual, verificando:

- Se a resposta não inventa dados.
- Se os grupos retornados são compatíveis com a pergunta.
- Se a resposta está apoiada em dados efetivamente coletados.
- Se a recuperação usa corretamente áreas e linhas de pesquisa.

## 9. Diretrizes Futuras

Para a evolução do MVP rumo a um sistema de produção escalável, foram definidas as seguintes diretrizes:

### 9.1 Mensageria e Processamento Assíncrono (Redis)
- **Desativação da API de IA:** O serviço LangChain deixará de ser uma API FastAPI síncrona e passará a operar como um **Worker (Consumidor)**.
- **Fila de Vetorização:** O Scraper e o ETL atuarão como **Produtores**, enviando mensagens para filas no Redis (ex: `fila_embeddings`) contendo metadados e IDs dos documentos recém-processados.
- **Vantagens:** Maior resiliência contra falhas em APIs externas (Gemini/OpenAlex), controle refinado de *Rate Limit* e desacoplamento total entre a coleta de dados e a geração de inteligência semântica.

### 9.2 Persistência Vetorial
- Migração do Vector Store em memória (FAISS) para o **PostgreSQL com extensão pgvector**.
- Isso permitirá consultas híbridas (SQL + Vetor) e persistência de longo prazo dos embeddings sem necessidade de re-vetorização total em cada inicialização.
