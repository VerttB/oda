import { Button } from '#/components/ui/button'
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="h-8 px-3 text-muted-foreground"
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((page) => (
        <Button
          key={page}
          type="button"
          variant={currentPage === page ? 'primary' : 'outline'}
          size="sm"
          onClick={() => onPageChange(page)}
          className="h-8 px-3 text-xs"
        >
          {page}
        </Button>
      ))}

      {safeTotalPages > 5 && pages.at(-1) !== safeTotalPages && (
        <span className="px-2 text-xs text-muted-foreground">...</span>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
        disabled={currentPage === safeTotalPages}
        className="h-8 px-3 text-muted-foreground"
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
