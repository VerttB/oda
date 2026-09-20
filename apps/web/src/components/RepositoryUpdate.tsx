import React from 'react'
import { ArrowRight } from 'lucide-react'
import { ArticleCard } from './ArticleCard'
import { Button } from './ui/button'
import type { ResearchArticle } from '../core/interfaces'

interface RepositoryUpdatesProps {
  articles: ResearchArticle[]
  onSelectArticle: (article: ResearchArticle) => void
  onSelectAuthor: (authorId: string) => void
  onViewAllClick?: () => void
}

export const RepositoryUpdates: React.FC<RepositoryUpdatesProps> = ({
  articles,
  onSelectArticle,
  onSelectAuthor,
  onViewAllClick,
}) => {
  return (
    <section id="recent-repository-updates">
      <div className="flex justify-between items-end mb-4 border-b border-border pb-2">
        <h2 className="text-2xl md:text-3xl font-semibold text-secondary tracking-tight">
          Atualizações Recentes do Repositório
        </h2>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onViewAllClick}
          className="h-auto gap-1.5 p-0 pb-0.5 text-xs uppercase tracking-wider text-primary hover:text-secondary"
        >
          <span>Ver todos</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {articles.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          Nenhuma atualização recente encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onSelectArticle={onSelectArticle}
              onSelectAuthor={onSelectAuthor}
            />
          ))}
        </div>
      )}
    </section>
  )
}
