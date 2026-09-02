import { ApiBanner } from '#/components/ApiBanner'
import { HeroMetrics } from '#/components/HeroMetrics'
import { RepositoryUpdates } from '#/components/RepositoryUpdate'
import { ResearchGroupCards } from '#/components/ResearchGroupCards'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { FilterState, ResearchArticle } from '../core/interfaces'
import { MOCK_ARTICLES, MOCK_RESEARCH_GROUPS } from '../core/mock'
import { SidebarFilters } from '#/components/SidebarFilterProps'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [, setActiveTab] = useState<string>('discover')
  const [searchQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>({
    fieldsOfStudy: [],
    publicationDate: 'Qualquer momento',
    searchQuery: '',
  })
  const [, setSelectedArticle] = useState<ResearchArticle | null>(null)

  const filteredArticles = useMemo(() => {
    return MOCK_ARTICLES.filter((article) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = article.title.toLowerCase().includes(q)
        const matchAbstract = article.abstract.toLowerCase().includes(q)
        const matchAuthor = article.author.name.toLowerCase().includes(q)
        const matchTag = article.tags.some((tag) =>
          tag.toLowerCase().includes(q),
        )
        if (!matchTitle && !matchAbstract && !matchAuthor && !matchTag) {
          return false
        }
      }

      if (
        filters.fieldsOfStudy.length > 0 &&
        !filters.fieldsOfStudy.includes(article.field)
      ) {
        return false
      }

      return true
    })
  }, [searchQuery, filters])

  return (
    <>
      <HeroMetrics />
      <ApiBanner />
      <div className="mx-auto max-w-[1280px] px-4 py-16 pb-16 md:px-10">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <SidebarFilters filters={filters} onFilterChange={setFilters} />
          </div>

          <div className="space-y-12 lg:col-span-3">
            <RepositoryUpdates
              articles={filteredArticles}
              onSelectArticle={(article) => setSelectedArticle(article)}
              onSelectAuthor={() => setActiveTab('publications')}
            />

            <ResearchGroupCards
              groups={MOCK_RESEARCH_GROUPS}
              onSelectGroup={() => setActiveTab('groups')}
              onExploreAllGroups={() => setActiveTab('groups')}
            />
          </div>
        </div>
      </div>
    </>
  )
}
