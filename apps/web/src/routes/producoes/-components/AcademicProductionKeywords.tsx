import { Button } from '#/components/ui/button'
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
          <Button
            key={keyword}
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onSelectKeyword?.(keyword)}
            className="border-emerald-600/40 bg-emerald-500/15 font-mono font-medium text-emerald-900 hover:bg-emerald-500/25"
            title={`Filtrar por ${keyword}`}
          >
            {keyword}
          </Button>
        ))}
      </div>
    </section>
  )
}
