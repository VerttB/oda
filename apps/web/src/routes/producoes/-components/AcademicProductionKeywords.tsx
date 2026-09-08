import { Tag } from 'lucide-react'
import type { FC } from 'react'

interface AcademicProductionKeywordsProps {
  keywords: string[]
  onSelectKeyword?: (keyword: string) => void
}

export const AcademicProductionKeywords: FC<
  AcademicProductionKeywordsProps
> = ({ keywords, onSelectKeyword }) => {
  return (
    <section className="dotted-border rounded-2xl bg-surface-container-lowest p-6 shadow-xs">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold tracking-tight text-primary">
        <Tag className="h-5 w-5 text-secondary" />
        <span>Palavras-chave</span>
      </h2>

      <div className="flex flex-wrap gap-2.5">
        {keywords.map((keyword) => (
          <button
            key={keyword}
            type="button"
            onClick={() => onSelectKeyword?.(keyword)}
            className="cursor-pointer rounded-md border border-emerald-600/40 bg-emerald-500/15 px-3 py-1.5 font-mono text-xs font-medium text-emerald-900 transition-colors hover:bg-emerald-500/25"
            title={`Filtrar por ${keyword}`}
          >
            {keyword}
          </button>
        ))}
      </div>
    </section>
  )
}
