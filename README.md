# Open DGP - Monorepo (TypeScript)

Sistema completo e unificado em TypeScript para extração, processamento, estruturação, busca semântica (RAG) e análise de grupos de pesquisa do CNPq/DGP.

---

## Tecnologias Principais
* **Node.js** (v20+) & **PNPM Workspaces**
* **NestJS** (API REST principal)
* **LangChain.js** (Serviço de RAG & busca semântica)
* **Crawlee & Playwright** (Web Scraping dos dados públicos)
* **Prisma ORM & PostgreSQL** (Persistência relacional e vetorial pgvector)
* **Redis** (Gerenciamento de cache da API)

---

## 🚀 Como Inicializar o Projeto

### 1. Instalação das Dependências
Na pasta raiz `/oda`, execute o comando abaixo para instalar todas as dependências do monorepo de forma otimizada:
```bash
pnpm install
```

### 2. Variáveis de Ambiente
Crie um arquivo `.env` na raiz `/oda` com base no arquivo `.env.example`:
```bash
cp .env.example .env
```
Preencha as variáveis, principalmente a chave de API da OpenAI (`OPEN_AI_KEY`) e as credenciais do PostgreSQL/Redis.

### 3. Subir a Infraestrutura (Docker)
Para subir o banco de dados e o cache Redis:
```bash
docker compose up -d postgres redis
```

---

## Executando os Serviços do Monorepo
###### *Todos os serviços são independentes e podem ser rodados separadamente*

Toda a execução pode ser feita a partir da raiz `/oda` utilizando filtros do `pnpm`:

### A. Scraper (Coleta de Dados)
Responsável por buscar os dados dos grupos e pesquisadores no CNPq/DGP utilizando Crawlee + Playwright:
```bash
pnpm run run:scraper
```

### B. ETL (Importação de Dados)
Processa os JSONs gerados pelo scraper e salva no banco de dados estruturado do PostgreSQL:
* **Importar Grupos de Pesquisa:**
  ```bash
  pnpm run etl:grupo
  ```
* **Importar Pesquisadores e Produções:**
  ```bash
  pnpm run etl:pesquisador
  ```
* **Vincular ISSN / Qualis retroativamente (Mapeamento de Metadados):**
  ```bash
  pnpm -F @oda/etl start fix -qualis
  ```

### C. API REST (Servidor Principal)
Fornece os endpoints de dados e integrações para o frontend:
```bash
pnpm run dev:api
```
A API rodará por padrão na porta `3000`.

### D. LangChain Service (Busca Semântica & RAG)
Gerencia a indexação vetorial e responde perguntas baseando-se nas produções acadêmicas:
* **Vetorizar e Sincronizar o Banco (Ingestão):**
  ```bash
  pnpm run ingest:db
  ```
* **Iniciar o serviço de RAG em desenvolvimento:**
  ```bash
  pnpm run dev:langchain
  ```
  O microserviço rodará na porta `8002`.

---

## 🐳 Executando com Docker Compose (Modo Produção)
Se desejar rodar todos os serviços da aplicação conteinerizados de uma única vez:
```bash
docker compose up --build -d
```

---

## Banco de Dados e Prisma

O projeto usa Prisma com PostgreSQL. Como o projeto ainda está em fase inicial, o fluxo atual de evolução do schema é feito com `db push`, não com migrations versionadas.

Comandos principais:

```bash
pnpm run prisma:push
pnpm run prisma:generate
pnpm run prisma:studio
```

Antes de mudanças destrutivas no schema, gere um backup do banco. Em especial, a modelagem atual de grupos de pesquisa usa uma tabela intermediária entre `GrupoPesquisa` e `Instituicao`; portanto, a relação direta antiga `grupo_pesquisa.instituicao_id` não faz mais parte do modelo.

Relação atual entre grupos e instituições:

- `GrupoPesquisa` representa os dados próprios do grupo.
- `Instituicao` representa instituições de ensino/pesquisa.
- `GrupoPesquisaInstituicao` representa o vínculo N:N entre grupo e instituição.
- Cada vínculo possui `tipoRelacao`, com valores `SEDE` ou `PARCEIRA`.
- Cada vínculo também pode possuir `unidade`, permitindo registrar a unidade da instituição naquele relacionamento específico.

Essa modelagem permite que um grupo tenha uma instituição sede e múltiplas instituições parceiras, sem duplicar dados institucionais.
