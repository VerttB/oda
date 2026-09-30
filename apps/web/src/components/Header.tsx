import { Button } from '#/components/ui/button'
import { DebouncedInput } from '#/components/ui/debounced-input'
import { useRouterState } from '@tanstack/react-router'
import React from 'react'
import { Search, X } from 'lucide-react'

interface NavbarProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  isDarkTheme?: boolean
}

export const Header: React.FC<NavbarProps> = ({
  activeTab = 'discover',
  onTabChange = () => {},
  searchQuery = '',
  onSearchChange = () => {},
  isDarkTheme = false,
}) => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const navItems: { id: string; label: string; href: string }[] = [
    { id: 'discover', label: 'Descobrir', href: '/' },
    { id: 'researchers', label: 'Pesquisadores', href: '/pesquisadores' },
    { id: 'groups', label: 'Grupos', href: '/grupos' },
    { id: 'publications', label: 'Publicações', href: '/producoes' },
    { id: 'docs', label: 'Docs da API', href: '/docs/geral' },
  ]

  const pathnameTab =
    pathname === '/'
      ? 'discover'
      : pathname.startsWith('/pesquisadores')
        ? 'researchers'
        : pathname.startsWith('/grupos')
          ? 'groups'
          : pathname.startsWith('/producoes')
            ? 'publications'
            : pathname.startsWith('/docs')
              ? 'docs'
              : activeTab

  const currentTab = activeTab === 'discover' ? pathnameTab : activeTab
  const isNavyNav = currentTab === 'discover' || isDarkTheme

  return (
    <header
      id="top-navbar"
      className={`fixed top-0 w-full z-50 transition-colors duration-200 ${
        isNavyNav
          ? 'bg-secondary border-b border-secondary text-white'
          : 'bg-white border-b border-border-subtle text-secondary shadow-xs'
      }`}
    >
      <div className="max-w-[1280px] mx-auto flex justify-between items-center h-[72px] md:h-[80px] px-4 md:px-8">
        {/* Marca e busca */}
        <div className="flex items-center gap-6">
          <a
            id="brand-logo"
            href="/"
            onClick={() => onTabChange('discover')}
            className={`font-semibold text-2xl md:text-3xl tracking-tight transition-transform hover:opacity-90 flex items-center gap-2 ${
              isNavyNav ? 'text-white' : 'text-secondary'
            }`}
          >
            <span>ODA</span>
          </a>

          {/* Campo de busca */}
          <div
            className={`hidden md:flex items-center px-3.5 py-1.5 rounded-lg border transition-all w-[280px] lg:w-[320px] ${
              isNavyNav
                ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-within:border-accent focus-within:bg-white/15'
                : 'bg-slate-50 border-border-subtle text-foreground placeholder:text-muted-foreground focus-within:border-secondary focus-within:bg-white'
            }`}
          >
            <Search
              className={`w-4 h-4 mr-2.5 shrink-0 ${isNavyNav ? 'text-white/70' : 'text-muted-foreground'}`}
            />
            <DebouncedInput
              id="global-search-input"
              type="text"
              variant="ghost"
              size="sm"
              placeholder="Procurar Pesquisadores, Grupos, Publicações..."
              value={searchQuery}
              onValueChange={onSearchChange}
              className="h-auto border-none bg-transparent p-0 text-sm font-normal focus:border-transparent focus:ring-0"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onSearchChange('')}
                className="size-6 rounded-full p-1 hover:bg-transparent hover:opacity-80"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Links centrais de navegação */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8">
          {navItems.map((item) => {
            const isActive = currentTab === item.id
            return (
              <a
                key={item.id}
                id={`nav-link-${item.id}`}
                href={item.href}
                onClick={() => onTabChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative cursor-pointer py-1 text-sm font-medium transition-colors md:text-base ${
                  isActive
                    ? isNavyNav
                      ? 'font-semibold text-white'
                      : 'font-semibold text-secondary'
                    : isNavyNav
                      ? 'text-white/70 hover:text-white'
                      : 'text-muted-foreground hover:text-secondary'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    className={`absolute -bottom-2 left-0 h-0.5 w-full rounded-full ${
                      isNavyNav ? 'bg-white' : 'bg-secondary'
                    }`}
                  />
                )}
              </a>
            )
          })}
        </nav>
      </div>

      {/* Subnavegação mobile */}
      <div className="md:hidden flex items-center overflow-x-auto px-4 py-2 border-t border-white/10 gap-3 text-xs">
        {navItems.map((item) => (
          <a
            key={item.id}
            href={item.href}
            onClick={() => onTabChange(item.id)}
            className={`whitespace-nowrap px-3 py-1 rounded-full font-medium transition-colors ${
              currentTab === item.id
                ? isNavyNav
                  ? 'bg-white text-secondary font-semibold'
                  : 'bg-secondary text-white font-semibold'
                : isNavyNav
                  ? 'text-white/70 bg-white/10'
                  : 'text-muted-foreground bg-muted'
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </header>
  )
}
