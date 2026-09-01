import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { FC } from 'react'

interface ProductionsPaginationProps {
  currentPage: number
  onPageChange: (page: number) => void
  totalPages?: number
}

export const ProductionsPagination: FC<ProductionsPaginationProps> = ({
  currentPage,
  onPageChange,
  totalPages = 1,
}) => {
  const safeTotalPages = Math.max(1, totalPages)
  const pages = Array.from(
    { length: Math.min(safeTotalPages, 5) },
    (_, index) => {
      const firstVisiblePage = Math.max(
        1,
        Math.min(currentPage - 2, safeTotalPages - 4),
      )

      return firstVisiblePage + index
    },
  )

  return (
    <div className="mt-8 flex items-center justify-center space-x-2 border-t border-border-subtle pt-4">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="flex cursor-pointer items-center justify-center rounded border border-border-subtle px-3 py-1 text-muted-foreground hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onPageChange(page)}
          className={`cursor-pointer rounded px-3 py-1 text-xs font-semibold ${
            currentPage === page
              ? 'bg-primary text-white'
              : 'border border-border-subtle text-secondary hover:bg-surface'
          }`}
        >
          {page}
        </button>
      ))}

      {safeTotalPages > 5 && pages.at(-1) !== safeTotalPages && (
        <span className="px-2 text-xs text-muted-foreground">...</span>
      )}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
        disabled={currentPage === safeTotalPages}
        className="flex cursor-pointer items-center justify-center rounded border border-border-subtle px-3 py-1 text-muted-foreground hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
