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
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-secondary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
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
              : 'text-primary hover:bg-surface'
          }`}
        >
          {page}
        </button>
      ))}

      {totalPages > 5 && pages.at(-1) !== totalPages && (
        <span className="px-1 text-xs text-muted-foreground">...</span>
      )}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-secondary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
