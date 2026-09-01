import type { ProductionItem } from '#/core/interfaces'
import {
  Book,
  BookOpen,
  Check,
  Copy,
  Eye,
  FileText,
  Presentation,
} from 'lucide-react'
import type { FC, MouseEvent } from 'react'

interface ProductionsListItemProps {
  production: ProductionItem
  onSelect: (production: ProductionItem) => void
  copiedCitationId: string | null
  onCopyCitation: (production: ProductionItem, event: MouseEvent) => void
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'Livro':
      return <Book className="h-3.5 w-3.5" />
    case 'Capítulo':
    case 'Capítulo de livro':
      return <BookOpen className="h-3.5 w-3.5" />
    case 'Trabalhos em eventos':
    case 'Conferência':
      return <Presentation className="h-3.5 w-3.5" />
    case 'Artigo':
    default:
      return <FileText className="h-3.5 w-3.5" />
  }
}

export const ProductionsListItem: FC<ProductionsListItemProps> = ({
  production,
  onSelect,
  copiedCitationId,
  onCopyCitation,
}) => {
  const authorsDisplay = Array.isArray(production.authors)
    ? production.authors.join(', ')
    : production.authors

  const isCopied = copiedCitationId === production.id

  return (
    <article className="-mx-3 flex items-start justify-between gap-4 rounded px-3 py-4 transition-colors hover:bg-surface/70">
      <div className="min-w-0 flex-grow">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 text-[11px] font-semibold text-secondary">
            {getTypeIcon(production.type)}
            <span>{production.type}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {production.year}
          </span>
          {production.qualis && (
            <span className="rounded border border-accent/20 bg-accent-light px-2 py-0.5 text-[11px] font-semibold text-accent-dark">
              Qualis {production.qualis}
            </span>
          )}
          {(production.isOpenAccess || production.openAccess) && (
            <span className="rounded border border-border-subtle bg-surface px-2 py-0.5 text-[11px] font-semibold text-secondary">
              Acesso aberto
            </span>
          )}
          {typeof production.citations === 'number' &&
            production.citations > 0 && (
              <span className="text-xs font-medium text-secondary">
                • {production.citations} citações
              </span>
            )}
        </div>

        <button
          type="button"
          onClick={() => onSelect(production)}
          className="mb-1 cursor-pointer text-left text-base font-semibold leading-snug text-primary transition-colors hover:text-primary-hover md:text-lg"
        >
          {production.title}
        </button>

        <p className="mb-1 text-xs text-muted-foreground md:text-sm">
          {authorsDisplay}
        </p>

        {(production.journalOrConference || production.venue) && (
          <p className="text-xs italic text-muted-foreground md:text-sm">
            {production.journalOrConference || production.venue}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-secondary">
          {production.institution && (
            <span className="font-medium text-primary">
              {production.institution}
            </span>
          )}
          {production.doi && (
            <span className="font-mono text-secondary">
              DOI: {production.doi}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col space-y-2 opacity-80 transition-opacity sm:opacity-100">
        <button
          type="button"
          onClick={() => onSelect(production)}
          className="cursor-pointer rounded border border-border-subtle bg-surface p-2 text-secondary transition-colors hover:text-primary"
          title="Ver detalhes"
          aria-label="Ver detalhes"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(event) => onCopyCitation(production, event)}
          className="cursor-pointer rounded border border-border-subtle bg-surface p-2 text-secondary transition-colors hover:text-primary"
          title={isCopied ? 'Citação copiada' : 'Copiar citação'}
          aria-label="Copiar citação"
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </article>
  )
}
