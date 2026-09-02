import React from 'react'
import {
  ArrowRight,
  Microscope,
  Globe,
  Brain,
  Network,
  Cpu,
  Code,
} from 'lucide-react'

interface ResearchGroupSummary {
  id: string
  name: string
  description: string
  membersCount: number
  icon: 'biotech' | 'public' | 'psychology' | 'hub' | 'code' | 'cpu'
}
interface ResearchGroupCardsProps {
  groups: ResearchGroupSummary[]
  onSelectGroup: (groupId: string) => void
  onExploreAllGroups: () => void
}

export const ResearchGroupCards: React.FC<ResearchGroupCardsProps> = ({
  groups,
  onSelectGroup,
  onExploreAllGroups,
}) => {
  const renderIcon = (iconType: ResearchGroupSummary['icon']) => {
    switch (iconType) {
      case 'biotech':
        return <Microscope className="w-8 h-8 text-secondary" />
      case 'public':
        return <Globe className="w-8 h-8 text-secondary" />
      case 'psychology':
        return <Brain className="w-8 h-8 text-secondary" />
      case 'hub':
        return <Network className="w-8 h-8 text-secondary" />
      case 'cpu':
        return <Cpu className="w-8 h-8 text-secondary" />
      default:
        return <Code className="w-8 h-8 text-secondary" />
    }
  }

  return (
    <section id="top-research-groups" className="mt-12">
      <div className="flex justify-between items-end mb-4 border-b border-border pb-2">
        <h2 className="text-2xl md:text-3xl font-semibold text-secondary tracking-tight">
          Grupos de Pesquisa Adicionados Recentemente
        </h2>
        <button
          onClick={onExploreAllGroups}
          className="text-xs font-semibold uppercase tracking-wider text-primary hover:text-secondary transition-colors flex items-center gap-1.5 cursor-pointer pb-0.5"
        >
          <span>Explorar Grupos</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => (
          <div
            key={group.id}
            id={`group-summary-card-${group.id}`}
            onClick={() => onSelectGroup(group.id)}
            className="bg-surface border border-border p-6 flex flex-col items-center text-center hover:bg-surface-alt hover:border-accent transition-all cursor-pointer shadow-[0_4px_12px_rgba(15,23,42,0.05)] rounded-lg group"
          >
            <div className="w-16 h-16 rounded-full bg-surface-alt flex items-center justify-center text-secondary mb-4 group-hover:scale-105 transition-transform border border-border">
              {renderIcon(group.icon)}
            </div>
            <h3 className="text-xl font-semibold text-secondary mb-2 group-hover:text-accent-hover transition-colors">
              {group.name}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {group.description}
            </p>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-auto bg-white/70 px-3 py-1 rounded-full border border-border">
              {group.membersCount.toLocaleString('pt-BR')} membros
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
