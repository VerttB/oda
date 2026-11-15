import { Menu, Search } from 'lucide-react'

import type { AdminSubTab } from '../../../types'

interface AdminTopAppBarProps {
  activeSubTab: AdminSubTab
  searchQuery: string
  onSearchChange: (value: string) => void
  onOpenMobileMenu: () => void
  onToast: (message: string) => void
  onOpenSettings: () => void
}

const TITLES: Record<AdminSubTab, string> = {
  dashboard: 'Plataforma ODA',
  queues: 'Filas e workers',
  routes: 'Rotas da API',
  researchers: 'Pesquisadores',
  console: 'Console de comandos',
  scraper: 'Logs do coletor',
  logs: 'Logs do sistema',
}

const SEARCH_PLACEHOLDERS: Record<AdminSubTab, string> = {
  dashboard: 'Filtrar IDs desta página...',
  queues: 'Buscar jobs...',
  routes: 'Buscar rotas...',
  researchers: 'Buscar pesquisadores...',
  console: 'Buscar comandos...',
  scraper: 'Filtrar IDs desta página...',
  logs: 'Filtrar IDs desta página...',
}

export function AdminTopAppBar({activeSubTab,searchQuery,onSearchChange,onOpenMobileMenu}:AdminTopAppBarProps) {
  return <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-[#c6c6cd]/50 bg-[#f4faff] px-4 shadow-2xs md:px-8">
    <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-6">
      <button type="button" onClick={onOpenMobileMenu} className="p-1.5 text-secondary md:hidden" aria-label="Abrir menu"><Menu className="size-5"/></button>
      <span className="truncate text-lg font-semibold text-black md:text-xl">{TITLES[activeSubTab]}</span>
      <div className="relative hidden max-w-xs flex-1 sm:block">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-secondary"/>
        <input type="search" aria-label={SEARCH_PLACEHOLDERS[activeSubTab]} value={searchQuery} onChange={event=>onSearchChange(event.target.value)} placeholder={SEARCH_PLACEHOLDERS[activeSubTab]} className="w-full rounded-lg border bg-[#ecf5fb] py-1.5 pr-3 pl-9 text-xs"/>
      </div>
    </div>
    <a href="/docs" className="hidden shrink-0 text-sm text-cyan-800 underline md:inline">Docs da API</a>
  </header>
}
