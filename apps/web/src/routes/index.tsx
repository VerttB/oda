import { ApiBanner } from '#/components/ApiBanner'
import { HeroMetrics } from '#/components/HeroMetrics'
import { RepositoryUpdates } from '#/components/RepositoryUpdate'
import { ResearchGroupCards } from '#/components/ResearchGroupCards'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { FilterState, ResearchArticle } from '../core/interfaces'
import {
  MOCK_ARTICLES,
  MOCK_RESEARCH_GROUPS,
  MOCK_GROUP_DETAIL,
  MOCK_RESEARCHER_PROFILE
} from '../core/mock';
import { SidebarFilters } from '#/components/SidebarFilterProps'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [activeTab, setActiveTab] = useState<string>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    fieldsOfStudy: [],
    publicationDate: 'Any time',
    searchQuery: ''
  });
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<ResearchArticle | null>(null);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);

   const filteredArticles = useMemo(() => {
    return MOCK_ARTICLES.filter((article) => {
      // Search text filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = article.title.toLowerCase().includes(q);
        const matchAbstract = article.abstract.toLowerCase().includes(q);
        const matchAuthor = article.author.name.toLowerCase().includes(q);
        const matchTag = article.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchAbstract && !matchAuthor && !matchTag) return false;
      }

      // Field of study filter
      if (
        filters.fieldsOfStudy.length > 0 &&
        !filters.fieldsOfStudy.includes(article.field)
      ) {
        return false;
      }

      return true;
    });
  }, [searchQuery, filters]);
  
  return <>
    <HeroMetrics/>
    <ApiBanner/>
     <div className="max-w-[1280px] mx-auto py-16 px-4 md:px-10 pb-16">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                {/* Left: Filter Sidebar */}
                <div className="lg:col-span-1">
                  <SidebarFilters
                    filters={filters}
                    onFilterChange={setFilters}
                  />
                </div>

                {/* Right: Updates & Group Cards */}
                <div className="lg:col-span-3 space-y-12">
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
}
