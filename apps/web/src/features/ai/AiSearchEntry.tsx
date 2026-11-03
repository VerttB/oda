import { Link } from '@tanstack/react-router'
import { Sparkles, ArrowRight } from 'lucide-react'
import type { SemanticEntity } from '#/api/ai'

export function AiSearchEntry({ entity }: { entity: SemanticEntity }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-6 md:px-10">
      <Link
        to="/ia"
        search={{ modo: 'busca', entidade: entity, q: '', page: 1 }}
        preload={false}
        className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary hover:bg-primary/10"
      >
        <Sparkles className="size-5 shrink-0" />
        <span className="flex-1">
          Não sabe o termo exato? Explore por significado com a busca semântica.
        </span>
        <ArrowRight className="size-4 shrink-0" />
      </Link>
    </div>
  )
}
