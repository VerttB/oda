import {
  FileText,
  GraduationCap,
  ListTree,
  PanelLeft,
  PanelLeftClose,
  Rocket,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import type { FC, ReactNode } from 'react'

export type DocsPage = 'geral' | 'endpoint' | 'filtros'

interface DocsSidebarProps {
  activePage: DocsPage
  isCollapsed: boolean
  onToggleCollapse: () => void
}

interface DocsNavItem {
  id: DocsPage
  label: string
  href: string
  icon: ReactNode
}

export const DocsSidebar: FC<DocsSidebarProps> = ({
  activePage,
  isCollapsed,
  onToggleCollapse,
}) => {
  const mainItems: DocsNavItem[] = [
    {
      id: 'geral',
      label: 'Geral',
      href: '/docs/geral',
      icon: <Rocket className="h-5 w-5" />,
    },
  ]

  const apiReferenceItems: DocsNavItem[] = [
    {
      id: 'endpoint',
      label: 'Endpoints',
      href: '/docs/endpoint',
      icon: <ListTree className="h-5 w-5" />,
    },
    {
      id: 'filtros',
      label: 'Filtros',
      href: '/docs/filtros',
      icon: <SlidersHorizontal className="h-5 w-5" />,
    },
  ]

  const resourcesItems = [
    {
      label: 'Currículos Lattes',
      icon: <GraduationCap className="h-5 w-5" />,
    },
    {
      label: 'Grupos DGP',
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: 'Produções',
      icon: <FileText className="h-5 w-5" />,
    },
  ]

  const renderNavLink = (item: DocsNavItem) => {
    const isActive = activePage === item.id

    return (
      <a
        key={item.id}
        href={item.href}
        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
          isActive
            ? 'border border-border-subtle bg-surface-alt font-semibold text-accent'
            : 'text-foreground hover:bg-slate-100 hover:text-secondary'
        }`}
        title={item.label}
      >
        <span
          className={`shrink-0 ${isActive ? 'text-accent' : 'text-muted-foreground'}`}
        >
          {item.icon}
        </span>
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </a>
    )
  }

  return (
    <aside
      id="api-docs-sidebar"
      className={`sticky top-[92px] hidden h-[calc(100vh-110px)] shrink-0 overflow-y-auto border-r border-border pr-4 transition-all duration-300 md:block ${
        isCollapsed ? 'w-20' : 'w-64 lg:w-72'
      }`}
    >
      <div className="mb-3 mt-2 flex items-center justify-between">
        {!isCollapsed && (
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Documentação
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="ml-auto cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-secondary"
          title={isCollapsed ? 'Expandir navegação' : 'Recolher navegação'}
        >
          {isCollapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="flex flex-col gap-1.5 text-sm">
        {mainItems.map(renderNavLink)}

        <div
          className={`mb-1.5 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${isCollapsed ? 'hidden' : 'block'}`}
        >
          Referência da API
        </div>

        {apiReferenceItems.map(renderNavLink)}

        <div
          className={`mb-1.5 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${isCollapsed ? 'hidden' : 'block'}`}
        >
          Recursos
        </div>

        {resourcesItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground"
            title={item.label}
          >
            <span className="shrink-0">{item.icon}</span>
            {!isCollapsed && <span className="truncate">{item.label}</span>}
          </div>
        ))}
      </nav>
    </aside>
  )
}
