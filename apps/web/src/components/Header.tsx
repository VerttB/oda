import { Button } from '#/components/ui/button'
import { DebouncedInput } from '#/components/ui/debounced-input'
import { useRouterState } from '@tanstack/react-router'
import React, { useState } from 'react'
import { Search, X, ArrowRight } from 'lucide-react'

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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
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

        {/* Ações à direita */}
        <div className="flex items-center gap-3 md:gap-4 relative">
          {/* Botão de notificações */}

          {/* Botão de perfil */}
          <div className="relative">
            <Button
              id="profile-btn"
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setUserMenuOpen(!userMenuOpen)
              }}
              className={`size-auto rounded-full p-1.5 ${
                isNavyNav
                  ? 'text-white/80 hover:text-white hover:bg-white/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-slate-100'
              }`}
              title="Conta de pesquisador"
            >
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7pIzfuk-eLdC6Nxn0ePVr_99DzfWdGIpClj5V6n4AnFHnvAMLY0s76dXJhh9N1nf-zzcKOm7aFpPmR9G4zSoOdp_VR3DN2B6PlTRJZrfMKOOgv2S3Zlbp5QyzGPEJ4J2MbuaolT4Sm8UccsUncpmh4zVNS2ANfUsZHkjTcEJoWO2DBMCVKaw4JYCOkqKV4RVAae6n38Fcq6hSX7mjOgeRsFAZIHpCs28O_BqqLc-w7G5ayrwdc48_"
                alt="Avatar da conta"
                className="w-8 h-8 rounded-full object-cover border border-accent"
              />
            </Button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white text-foreground rounded-xl shadow-xl border border-border-subtle p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="font-semibold text-secondary">
                    Dr. Elena Rostova
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    elena.rostova@mit.edu
                  </p>
                </div>
                <a
                  href="/pesquisadores"
                  onClick={() => {
                    onTabChange('researchers')
                    setUserMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-md font-medium text-slate-700 flex items-center justify-between"
                >
                  <span>Meu perfil de pesquisador</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
                <a
                  href="/grupos"
                  onClick={() => {
                    onTabChange('groups')
                    setUserMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-md font-medium text-slate-700 flex items-center justify-between"
                >
                  <span>Meus grupos DGP</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
                <a
                  href="/docs/geral"
                  onClick={() => {
                    onTabChange('docs')
                    setUserMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-md font-medium text-slate-700 flex items-center justify-between"
                >
                  <span>Chaves e docs da API</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
              </div>
            )}
          </div>
        </div>
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
