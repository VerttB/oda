import { Button } from '#/components/ui/button'
import { DebouncedInput } from '#/components/ui/debounced-input'
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import type { FC } from 'react'

interface GroupFilterSidebar {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedUf: string
  onUfChange: (uf: string) => void
  selectedArea: string
  onAreaChange: (area: string) => void
  selectedStatus: string
  onStatusChange: (status: string) => void
  onClearFilters: () => void
  onApplyFilters?: () => void
}

const KNOWLEDGE_AREAS = [
  'Todas as Áreas',
  'Engenharia',
  'Ciências Biológicas',
  'Ciências da Computação',
  'Física',
  'Sociologia',
  'Ciências da Saúde',
]

const UF_OPTIONS = [
  { value: '', label: 'Todos os estados' },
  { value: 'SP', label: 'São Paulo (SP)' },
  { value: 'RJ', label: 'Rio de Janeiro (RJ)' },
  { value: 'MG', label: 'Minas Gerais (MG)' },
  { value: 'RS', label: 'Rio Grande do Sul (RS)' },
  { value: 'BA', label: 'Bahia (BA)' },
  { value: 'PE', label: 'Pernambuco (PE)' },
]

export const DirectoryFilterSidebar: FC<GroupFilterSidebar> = ({
  searchQuery,
  onSearchChange,
  selectedUf,
  onUfChange,
  selectedArea,
  onAreaChange,
  selectedStatus,
  onStatusChange,
  onClearFilters,
  onApplyFilters,
}) => {
  const hasActiveFilters =
    Boolean(searchQuery) ||
    Boolean(selectedUf) ||
    Boolean(selectedArea) ||
    selectedStatus !== 'Todos'

  return (
    <aside className="w-full shrink-0 border-border-subtle lg:w-64 lg:border-r lg:pr-6">
      <div className="sticky top-24 space-y-6">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <SlidersHorizontal className="h-4 w-4 text-secondary" />
            <span>Filtros</span>
          </h3>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onClearFilters}
              className="h-auto px-0 text-secondary hover:bg-transparent hover:text-primary"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpar</span>
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {/* Filtro por nome do grupo */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary">
              Nome do grupo
            </label>
            <div className="relative">
              <DebouncedInput
                type="text"
                variant="default"
                size="sm"
                leftIcon={<Search />}
                placeholder="Ex.: ciência de dados"
                value={searchQuery}
                onValueChange={onSearchChange}
                className="pr-8 placeholder:text-secondary"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onSearchChange('')}
                  className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-secondary hover:bg-transparent hover:text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary">
              Estado / UF
            </label>
            <select
              value={selectedUf}
              onChange={(e) => onUfChange(e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-border-subtle bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {UF_OPTIONS.map((uf) => (
                <option key={uf.value} value={uf.value}>
                  {uf.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary">
              Área de Conhecimento
            </label>
            <select
              value={selectedArea}
              onChange={(e) => onAreaChange(e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-border-subtle bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {KNOWLEDGE_AREAS.map((area) => (
                <option
                  key={area}
                  value={area === 'Todas as Áreas' ? '' : area}
                >
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary">
              Status do Grupo
            </label>
            <div className="flex gap-2">
              {['Todos', 'Ativo', 'Arquivado'].map((st) => (
                <Button
                  key={st}
                  type="button"
                  variant={selectedStatus === st ? 'secondary' : 'outline'}
                  size="xs"
                  onClick={() => onStatusChange(st)}
                  className="flex-1 rounded text-[11px]"
                >
                  {st}
                </Button>
              ))}
            </div>
          </div>

          <Button type="button" size="sm" fullWidth onClick={onApplyFilters}>
            Aplicar filtros
          </Button>
        </div>
      </div>
    </aside>
  )
}
