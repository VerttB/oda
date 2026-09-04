import {
  CheckCircle,
  Gauge,
  GraduationCap,
  Info,
  Key,
  ListTree,
  Send,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { useState, type FC, type ReactNode } from 'react'
import { CodeSnippetBox } from './CodeSnippet'

const BASE_URL = 'https://oda.vertb.com.br'

const CURL_CODE = `curl -X GET "${BASE_URL}/pesquisadores?size=5" \\
  -H "Authorization: Bearer SUA_CHAVE_DE_API" \\
  -H "Accept: application/json"`

const PYTHON_CODE = `import requests

url = "${BASE_URL}/grupos-pesquisa"
headers = {
    "Authorization": "Bearer SUA_CHAVE_DE_API",
    "Accept": "application/json"
}

response = requests.get(url, headers=headers)
data = response.json()
print(data)`

const RESPONSE_JSON = `{
  "data": [
    {
      "id": "DGP-44521",
      "nome": "Laboratório de Inteligência Artificial Aplicada",
      "instituicao": "Universidade de São Paulo",
      "uf": "SP"
    }
  ],
  "meta": {
    "pagina": 1,
    "total": 1
  }
}`

const ENDPOINT_GROUPS = [
  {
    entity: 'Aplicação',
    description: 'Rotas básicas de disponibilidade da API.',
    endpoints: [
      {
        path: '/',
        description: 'Retorna uma resposta simples de saúde da aplicação.',
      },
    ],
  },
  {
    entity: 'Grupos de pesquisa',
    description:
      'Consulta de grupos DGP, relacionamento com pesquisadores e busca semântica.',
    endpoints: [
      {
        path: '/grupos-pesquisa',
        description: 'Lista grupos de pesquisa com dados institucionais.',
      },
      {
        path: '/grupos-pesquisa/busca-semantica',
        description: 'Busca grupos de pesquisa por similaridade semântica.',
      },
      {
        path: '/grupos-pesquisa/{id}/pesquisadores',
        description: 'Lista pesquisadores vinculados a um grupo de pesquisa.',
      },
      {
        path: '/grupos-pesquisa/{id}',
        description: 'Retorna os dados completos de um grupo específico.',
      },
    ],
  },
  {
    entity: 'Pesquisadores',
    description:
      'Consulta de pesquisadores, vínculo com grupos, produções e busca semântica.',
    endpoints: [
      {
        path: '/pesquisadores',
        description:
          'Lista pesquisadores com paginação e filtros por nome, formação, tipo e identificadores externos.',
      },
      {
        path: '/pesquisadores/busca-semantica',
        description: 'Busca pesquisadores por similaridade semântica.',
      },
      {
        path: '/pesquisadores/{id}',
        description: 'Retorna os dados de um pesquisador específico.',
      },
      {
        path: '/pesquisadores/{id}/producoes',
        description: 'Lista produções vinculadas a um pesquisador específico.',
      },
    ],
  },
  {
    entity: 'Produções',
    description:
      'Consulta de produções acadêmicas catalogadas e busca semântica.',
    endpoints: [
      {
        path: '/producoes',
        description:
          'Lista produções acadêmicas com filtros por título, ano, tipo, pesquisador, grupo e paginação.',
      },
      {
        path: '/producoes/busca-semantica',
        description: 'Busca produções por similaridade semântica.',
      },
      {
        path: '/producoes/{id}',
        description: 'Retorna os dados de uma produção específica.',
      },
    ],
  },
  {
    entity: 'Instituições',
    description: 'Consulta de instituições cadastradas na base.',
    endpoints: [
      {
        path: '/instituicao',
        description: 'Lista instituições com filtro por nome e paginação.',
      },
      {
        path: '/instituicao/{id}',
        description: 'Retorna os dados de uma instituição específica.',
      },
    ],
  },
  {
    entity: 'Linhas de pesquisa',
    description: 'Consulta de linhas de pesquisa e busca semântica.',
    endpoints: [
      {
        path: '/linha-pesquisa',
        description:
          'Lista linhas de pesquisa com filtros por grupo, nome e paginação.',
      },
      {
        path: '/linha-pesquisa/busca-semantica',
        description: 'Busca linhas de pesquisa por similaridade semântica.',
      },
      {
        path: '/linha-pesquisa/{id}',
        description: 'Retorna os dados de uma linha de pesquisa específica.',
      },
    ],
  },
  {
    entity: 'Áreas de conhecimento',
    description: 'Consulta de áreas de conhecimento cadastradas.',
    endpoints: [
      {
        path: '/area-conhecimento',
        description:
          'Lista áreas de conhecimento com filtro por nome e paginação.',
      },
      {
        path: '/area-conhecimento/{id}',
        description: 'Retorna os dados de uma área de conhecimento específica.',
      },
    ],
  },
  {
    entity: 'UFs',
    description: 'Consulta de unidades federativas.',
    endpoints: [
      { path: '/uf', description: 'Lista todas as UFs cadastradas.' },
      { path: '/uf/{id}', description: 'Retorna uma UF pelo identificador.' },
      { path: '/uf/sigla/{sigla}', description: 'Retorna uma UF pela sigla.' },
    ],
  },
  {
    entity: 'Métricas',
    description: 'Consulta de indicadores consolidados da plataforma.',
    endpoints: [
      { path: '/metricas', description: 'Retorna métricas gerais da base.' },
      {
        path: '/metricas/grupos-pesquisa',
        description:
          'Retorna totais, UFs com mais grupos e instituições com mais grupos.',
      },
      {
        path: '/metricas/grupos-pesquisa/{id}',
        description:
          'Retorna métricas consolidadas de um grupo de pesquisa específico.',
      },
      {
        path: '/metricas/pesquisadores',
        description:
          'Retorna métricas de pesquisadores, formação acadêmica e tipo de vínculo.',
      },
    ],
  },
  {
    entity: 'Langchain',
    description: 'Consulta de disponibilidade dos recursos de IA.',
    endpoints: [
      {
        path: '/langchain/health',
        description: 'Verifica a disponibilidade do módulo Langchain.',
      },
    ],
  },
]

const COMMON_FILTERS = [
  {
    name: 'page',
    type: 'number',
    description: 'Número da página retornada.',
    routes: [
      '/grupos-pesquisa',
      '/grupos-pesquisa/busca-semantica',
      '/pesquisadores',
      '/pesquisadores/busca-semantica',
      '/producoes',
      '/producoes/busca-semantica',
      '/instituicao',
      '/linha-pesquisa',
      '/linha-pesquisa/busca-semantica',
      '/area-conhecimento',
    ],
  },
  {
    name: 'size',
    type: 'number',
    description: 'Quantidade de registros por página.',
    routes: [
      '/grupos-pesquisa',
      '/grupos-pesquisa/busca-semantica',
      '/pesquisadores',
      '/pesquisadores/busca-semantica',
      '/producoes',
      '/producoes/busca-semantica',
      '/instituicao',
      '/linha-pesquisa',
      '/linha-pesquisa/busca-semantica',
      '/area-conhecimento',
    ],
  },
  {
    name: 'q',
    type: 'string',
    description: 'Termo usado nas buscas semânticas.',
    routes: [
      '/grupos-pesquisa/busca-semantica',
      '/pesquisadores/busca-semantica',
      '/producoes/busca-semantica',
      '/linha-pesquisa/busca-semantica',
    ],
  },
  {
    name: 'nome',
    type: 'string',
    description: 'Busca textual por nome.',
    routes: [
      '/grupos-pesquisa',
      '/pesquisadores',
      '/instituicao',
      '/linha-pesquisa',
      '/area-conhecimento',
    ],
  },
  {
    name: 'id',
    type: 'string',
    description: 'Identificador usado em rotas de detalhe ou relacionamento.',
    routes: [
      '/grupos-pesquisa/{id}',
      '/grupos-pesquisa/{id}/pesquisadores',
      '/pesquisadores/{id}',
      '/pesquisadores/{id}/producoes',
      '/producoes/{id}',
      '/instituicao/{id}',
      '/linha-pesquisa/{id}',
      '/area-conhecimento/{id}',
      '/uf/{id}',
      '/metricas/grupos-pesquisa/{id}',
    ],
  },
  {
    name: 'tipo',
    type: 'string',
    description: 'Filtra registros por tipo da entidade.',
    routes: ['/pesquisadores', '/producoes'],
  },
  {
    name: 'uf',
    type: 'string',
    description: 'Filtra grupos de pesquisa por sigla da unidade federativa.',
    routes: ['/grupos-pesquisa'],
  },
  {
    name: 'ano',
    type: 'number',
    description: 'Filtra produções pelo ano de publicação.',
    routes: ['/producoes'],
  },
  {
    name: 'anoFormacao',
    type: 'number',
    description: 'Filtra grupos pelo ano de formação.',
    routes: ['/grupos-pesquisa'],
  },
  {
    name: 'formacaoAcademica',
    type: 'string',
    description: 'Filtra pesquisadores por formação acadêmica.',
    routes: ['/pesquisadores'],
  },
  {
    name: 'titulo',
    type: 'string',
    description: 'Filtra produções pelo título.',
    routes: ['/producoes'],
  },
]

function DocsPageShell({
  children,
  description,
  eyebrow,
  title,
}: {
  children: ReactNode
  description: string
  eyebrow: string
  title: string
}) {
  return (
    <div id="docs-content-wrapper" className="max-w-4xl flex-1 space-y-8">
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </p>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight text-secondary md:text-5xl">
          {title}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
          {description}
        </p>
      </section>
      {children}
    </div>
  )
}

export const GeneralDocsContent: FC = () => {
  const [testEndpoint, setTestEndpoint] = useState('/grupos-pesquisa?size=5')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const runTestQuery = async () => {
    setLoading(true)
    setTestResult(null)

    try {
      const normalizedEndpoint = testEndpoint.startsWith('/')
        ? testEndpoint
        : `/${testEndpoint}`
      const response = await fetch(`${BASE_URL}${normalizedEndpoint}`, {
        headers: { Accept: 'application/json' },
      })
      const contentType = response.headers.get('content-type')
      const body = contentType?.includes('application/json')
        ? await response.json()
        : await response.text()

      setTestResult(
        JSON.stringify({ status: response.status, resposta: body }, null, 2),
      )
    } catch (error) {
      setTestResult(
        JSON.stringify(
          {
            erro:
              error instanceof Error
                ? error.message
                : 'Não foi possível executar a requisição.',
          },
          null,
          2,
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <DocsPageShell
      eyebrow="Geral"
      title="Documentação da API ODA"
      description="A API do Observatório de Dados Abertos oferece endpoints JSON para consultar pesquisadores, grupos de pesquisa do DGP, produções acadêmicas e métricas agregadas."
    >
      <section className="space-y-6">
        <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-primary-50 p-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2.5 font-mono text-sm text-primary">
            <Info className="h-5 w-5 shrink-0 text-primary" />
            <span className="font-semibold text-secondary">URL base:</span>
            <span className="rounded border border-border bg-white/80 px-2.5 py-1 text-xs md:text-sm">
              {BASE_URL}
            </span>
          </div>
          <span className="w-fit shrink-0 rounded bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-medium text-accent">
            v1 provisória ativa
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface-card p-5">
            <div className="mb-3 flex items-center gap-2 text-primary">
              <Key className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-secondary">
                Autenticação
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Quando a autenticação estiver habilitada, envie a chave no
              cabeçalho HTTP usando o padrão Bearer.
            </p>
            <div className="mt-4 rounded-lg border border-slate-700 bg-secondary p-3 font-mono text-xs text-slate-100">
              Authorization: Bearer SUA_CHAVE_DE_API
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-card p-5">
            <div className="mb-3 flex items-center gap-2 text-primary">
              <Gauge className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-secondary">
                Limites de uso
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Os limites finais ainda serão definidos. Para testes, evite
              disparos em alta frequência e prefira paginação moderada.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <GraduationCap className="h-6 w-6" />
          <h2 className="text-2xl font-semibold tracking-tight text-secondary">
            Currículos, grupos e produções
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          A API organiza a consulta em torno de pesquisadores, grupos de
          pesquisa, produções acadêmicas, instituições, áreas de conhecimento,
          linhas de pesquisa, UFs e métricas consolidadas.
        </p>
      </section>

      <section className="space-y-6 pt-2">
        <div className="border-b border-border pb-2">
          <h2 className="text-xl font-semibold text-secondary">
            Exemplos de implementação
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <CodeSnippetBox
            title="Autenticação com cURL"
            language="bash"
            code={CURL_CODE}
            onTryItOut={runTestQuery}
          />
          <CodeSnippetBox
            title="Python - buscar grupos de pesquisa"
            language="python"
            code={PYTHON_CODE}
            onTryItOut={runTestQuery}
          />
          <CodeSnippetBox
            title="Resposta: grupo DGP (200 OK)"
            language="json"
            code={RESPONSE_JSON}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface-card p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h2 className="font-semibold text-secondary">Playground da API</h2>
          </div>
          <span className="rounded border border-border bg-surface-alt px-2 py-0.5 font-mono text-xs text-muted-foreground">
            Modo de teste
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex items-center rounded-lg border border-border bg-surface-alt px-3 font-mono text-xs text-muted-foreground">
            GET
          </div>
          <input
            type="text"
            value={testEndpoint}
            onChange={(e) => setTestEndpoint(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-surface-alt px-3 py-2 font-mono text-sm text-foreground focus:border-accent focus:outline-hidden"
          />
          <button
            type="button"
            onClick={runTestQuery}
            disabled={loading}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-all hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin">⌛</span>
            ) : (
              <Send className="h-3.5 w-3.5 text-accent" />
            )}
            <span>Executar</span>
          </button>
        </div>
        {testResult && (
          <div className="animate-in fade-in overflow-x-auto rounded-lg border border-slate-700 bg-surface-dark p-3 font-mono text-xs text-slate-200">
            <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-accent">
              <CheckCircle className="h-3 w-3" /> Resultado da requisição
            </div>
            <pre>{testResult}</pre>
          </div>
        )}
      </section>
    </DocsPageShell>
  )
}

export const EndpointsDocsContent: FC = () => (
  <DocsPageShell
    eyebrow="Referência da API"
    title="Endpoints"
    description="Referência dedicada aos endpoints de leitura disponíveis na API, organizada pela entidade relacionada. Métodos de escrita e remoção não são exibidos nesta página."
  >
    <div className="flex w-fit items-center gap-2 rounded border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
      <ListTree className="h-3.5 w-3.5" />
      <span>Somente GET</span>
    </div>
    <section className="space-y-5">
      {ENDPOINT_GROUPS.map((group) => (
        <div
          key={group.entity}
          className="rounded-lg border border-border bg-background p-4"
        >
          <div className="mb-3">
            <h2 className="text-base font-semibold text-secondary">
              {group.entity}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {group.description}
            </p>
          </div>
          <div className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
            {group.endpoints.map((endpoint) => (
              <div
                key={endpoint.path}
                className="grid gap-3 bg-background p-3 md:grid-cols-[minmax(260px,0.95fr)_1fr] md:items-center"
              >
                <div className="flex min-w-0 items-center gap-2 font-mono text-sm">
                  <span className="shrink-0 rounded bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                    GET
                  </span>
                  <span className="truncate font-semibold text-primary">
                    {endpoint.path}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {endpoint.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  </DocsPageShell>
)

export const FiltersDocsContent: FC = () => (
  <DocsPageShell
    eyebrow="Referência da API"
    title="Filtros"
    description="Referência dos filtros e parâmetros comuns utilizados pelas rotas de leitura. Consulte esta página para entender paginação, busca textual, busca semântica e identificadores reutilizados."
  >
    <div className="flex w-fit items-center gap-2 rounded border border-primary/20 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary">
      <SlidersHorizontal className="h-3.5 w-3.5" />
      <span>Query e path params</span>
    </div>
    <section className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-background">
      {COMMON_FILTERS.map((filter) => (
        <div
          key={filter.name}
          className="grid gap-3 p-4 md:grid-cols-[160px_1fr] md:items-start"
        >
          <div className="space-y-1">
            <code className="font-mono text-sm font-semibold text-primary">
              {filter.name}
            </code>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {filter.type}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm leading-relaxed text-secondary">
              {filter.description}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {filter.routes.map((route) => (
                <code
                  key={`${filter.name}-${route}`}
                  className="rounded border border-border-subtle bg-surface-alt px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  {route}
                </code>
              ))}
            </div>
          </div>
        </div>
      ))}
    </section>
  </DocsPageShell>
)

export const DocsContent = GeneralDocsContent
