import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { FC } from 'react'

interface ResearchersPaginationProps {
  currentPage: number
  totalPages?: number
  onPageChange: (page: number) => void
}

export const ResearchersPagination: FC<ResearchersPaginationProps> = ({
  currentPage,
  totalPages = 1,
  onPageChange,
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
    <div className="mt-6 flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-border-subtle text-secondary transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onPageChange(page)}
          className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded text-xs font-semibold ${
            currentPage === page
              ? 'bg-primary text-white'
              : 'border border-border-subtle text-secondary hover:bg-surface'
          }`}
        >
          {page}
        </button>
      ))}

      {safeTotalPages > 5 && pages.at(-1) !== safeTotalPages && (
        <span className="flex h-8 w-8 items-center justify-center text-xs text-secondary">
          ...
        </span>
      )}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
        disabled={currentPage === safeTotalPages}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-border-subtle text-secondary transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
