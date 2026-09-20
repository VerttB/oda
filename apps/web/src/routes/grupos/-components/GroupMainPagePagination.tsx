import { Button } from '#/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DirectoryPaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export const DirectoryPagination: React.FC<DirectoryPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
    const firstVisiblePage = Math.max(
      1,
      Math.min(currentPage - 2, totalPages - 4),
    )

    return firstVisiblePage + index
  })

  return (
    <div className="mt-10 flex items-center justify-center gap-2 border-t border-border-subtle pt-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="size-8 text-secondary disabled:opacity-40"
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((page) => (
        <Button
          key={page}
          type="button"
          variant={currentPage === page ? 'primary' : 'ghost'}
          size="icon"
          onClick={() => onPageChange(page)}
          className="size-8 text-xs"
        >
          {page}
        </Button>
      ))}

      {totalPages > 5 && pages.at(-1) !== totalPages && (
        <span className="px-1 text-xs text-muted-foreground">...</span>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="size-8 text-secondary disabled:opacity-40"
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
