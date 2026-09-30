import { Button } from '#/components/ui/button'
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
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="size-8 text-secondary"
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((page) => (
        <Button
          key={page}
          type="button"
          variant={currentPage === page ? 'primary' : 'outline'}
          size="icon"
          onClick={() => onPageChange(page)}
          className="size-8 text-xs"
        >
          {page}
        </Button>
      ))}

      {safeTotalPages > 5 && pages.at(-1) !== safeTotalPages && (
        <span className="flex h-8 w-8 items-center justify-center text-xs text-secondary">
          ...
        </span>
      )}

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
        disabled={currentPage === safeTotalPages}
        className="size-8 text-secondary"
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
