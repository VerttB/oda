import { useState } from 'react'
import {
  Bell,
  CheckCircle2,
  CircleUserRound,
  HelpCircle,
  Loader2,
  Menu,
  Search,
} from 'lucide-react'

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
  dashboard: 'Buscar no console...',
  queues: 'Buscar jobs...',
  routes: 'Buscar rotas...',
  researchers: 'Buscar pesquisadores...',
  console: 'Buscar comandos...',
  scraper: 'Buscar logs...',
  logs: 'Buscar recursos e logs...',
}

export function AdminTopAppBar({
  activeSubTab,
  searchQuery,
  onSearchChange,
  onOpenMobileMenu,
  onToast,
  onOpenSettings,
}: AdminTopAppBarProps) {
  const [isDeploying, setIsDeploying] = useState(false)

  function handleDeploy() {
    setIsDeploying(true)
    onToast('Publicando alterações de configuração...')
    window.setTimeout(() => {
      setIsDeploying(false)
      onToast('Alterações publicadas com sucesso.')
    }, 1500)
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#c6c6cd]/50 bg-[#f4faff] px-4 shadow-2xs md:px-8">
      <div className="flex max-w-2xl flex-1 items-center gap-4 md:gap-6">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="p-1.5 text-secondary hover:text-primary md:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </button>

        <span className="whitespace-nowrap text-lg font-semibold tracking-normal text-black md:text-xl">
          {TITLES[activeSubTab]}
        </span>

        <div className="relative hidden max-w-xs flex-1 sm:block">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-secondary" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={SEARCH_PLACEHOLDERS[activeSubTab]}
            className="w-full rounded-lg border border-[#c6c6cd]/60 bg-[#ecf5fb] py-1.5 pr-3 pl-9 text-xs text-primary transition-all placeholder:text-[#45464d] focus:border-[#06b6d4] focus:ring-1 focus:ring-[#06b6d4] focus:outline-none"
          />
        </div>
      </div>

      {activeSubTab === 'dashboard' ? (
        <nav className="hidden items-center gap-6 text-xs font-semibold text-[#45464d] lg:flex">
          <button
            type="button"
            onClick={() => onToast('A documentação da API está atualizada.')}
            className="transition-colors hover:text-[#00687a]"
          >
            Documentação
          </button>
          <button
            type="button"
            onClick={() => onToast('Todos os serviços estão operacionais.')}
            className="flex items-center gap-1.5 transition-colors hover:text-[#00687a]"
          >
            <span className="size-2 rounded-full bg-[#10b981]" />
            Status da API
          </button>
          <span>Disponibilidade 99,98%</span>
        </nav>
      ) : null}

      <div className="flex items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={onOpenSettings}
          className="hidden rounded-lg border border-[#c6c6cd]/70 px-3 py-1.5 text-xs font-semibold tracking-wider text-[#45464d] uppercase transition-colors hover:bg-[#ecf5fb] hover:text-[#00687a] sm:inline-flex"
        >
          Configurações
        </button>

        <button
          type="button"
          onClick={handleDeploy}
          disabled={isDeploying}
          className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold tracking-wider text-white uppercase shadow-xs transition-all ${
            isDeploying
              ? 'cursor-wait bg-[#00687a]/80'
              : 'bg-[#10b981] hover:bg-[#059669]'
          }`}
        >
          {isDeploying ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          <span>{isDeploying ? 'Publicando...' : 'Publicar'}</span>
        </button>

        <button
          type="button"
          onClick={() => onToast('Nenhum alerta crítico no momento.')}
          className="relative rounded-full p-1.5 text-[#45464d] transition-colors hover:bg-[#ecf5fb] hover:text-[#00687a]"
          title="Notificações"
        >
          <Bell className="size-4" />
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-[#06b6d4]" />
        </button>

        <button
          type="button"
          onClick={() => onToast('Ajuda e base de conhecimento ODA')}
          className="hidden rounded-full p-1.5 text-[#45464d] transition-colors hover:bg-[#ecf5fb] hover:text-[#00687a] sm:block"
          title="Ajuda e suporte"
        >
          <HelpCircle className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => onToast('Sessão administrativa ativa')}
          className="ml-1 rounded-full border border-[#57dffe]/40 p-1.5 text-[#00687a] transition-all hover:ring-2 hover:ring-[#57dffe]"
          title="Perfil do administrador"
        >
          <CircleUserRound className="size-4" />
        </button>
      </div>
    </header>
  )
}
