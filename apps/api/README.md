# Open DGP API

API REST principal do Open DGP, implementada com NestJS e Prisma. Ela expõe os dados estruturados de grupos de pesquisa, instituições, linhas de pesquisa, pesquisadores e produções acadêmicas, além de encaminhar consultas semânticas para o serviço `apps/langchain-ts`.

## Responsabilidades

- Expor endpoints REST para consulta e manutenção dos dados transacionais.
- Validar entrada com `class-validator` e `ValidationPipe` global.
- Usar o Prisma Client do pacote compartilhado `@oda/database`.
- Aplicar cache em listagens quando adequado.
- Tratar erros conhecidos do Prisma por meio do filtro global de exceções.
- Encaminhar buscas semânticas para o serviço LangChain.

## Modelagem de Grupos e Instituições

`GrupoPesquisa` não possui mais `instituicaoId` ou `unidade` diretamente. A relação com instituições é feita por `GrupoPesquisaInstituicao`.

Cada vínculo contém:

- `grupoId`
- `instituicaoId`
- `tipoRelacao`: `SEDE` ou `PARCEIRA`
- `unidade`

Ao criar um grupo via API, envie `instituicoes[]` com pelo menos uma instituição. Se nenhuma relação vier marcada como `SEDE`, a API promove a primeira instituição da lista para sede.

Exemplo simplificado:

```json
{
  "dgpId": "1234567890123456",
  "nome": "Grupo de Pesquisa Exemplo",
  "anoFormacao": 2024,
  "areaPredominante": "Ciência da Computação",
  "instituicoes": [
    {
      "instituicaoId": "uuid-da-instituicao-sede",
      "tipoRelacao": "SEDE",
      "unidade": "Departamento de Ciências Exatas"
    },
    {
      "instituicaoId": "uuid-da-instituicao-parceira",
      "tipoRelacao": "PARCEIRA",
      "unidade": "Laboratório Parceiro"
    }
  ]
}
```

## Comandos

Executar em desenvolvimento a partir da raiz do monorepo:

```bash
pnpm run dev:api
```

Compilar todos os pacotes:

```bash
pnpm run build:all
```

Rodar testes da API:

```bash
pnpm -F @oda/api test
```

## Integrações

- Banco relacional e vetorial: PostgreSQL com Prisma e pgvector.
- Cache: Redis.
- Busca semântica/RAG: `apps/langchain-ts`.
- Dados de entrada: JSONs processados pelo ETL em `apps/etl`.
