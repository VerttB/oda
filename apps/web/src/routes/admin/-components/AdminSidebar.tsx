import type { ReactNode } from 'react'
import {
  ArrowLeft,
  FileCode,
  FileText,
  HelpCircle,
  LayoutDashboard,
  ListTodo,
  Network,
  ShieldCheck,
  Terminal,
  Users,
} from 'lucide-react'

import type { AdminSubTab } from '../../../types'

interface AdminSidebarProps {
  activeSubTab: AdminSubTab
  onSelectSubTab: (subTab: AdminSubTab) => void
  onOpenNewTrigger: () => void
  onExitAdmin: () => void
  isOpenMobile?: boolean
  onCloseMobile?: () => void
}

const NAV_ITEMS: { id: AdminSubTab; label: string; icon: ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Visão geral',
    icon: <LayoutDashboard className="size-4" />,
  },
  { id: 'queues', label: 'Filas', icon: <ListTodo className="size-4" /> },
  {
    id: 'routes',
    label: 'Rotas da API',
    icon: <Network className="size-4" />,
  },
  {
    id: 'researchers',
    label: 'Pesquisadores',
    icon: <Users className="size-4" />,
  },
  {
    id: 'console',
    label: 'Console de comandos',
    icon: <Terminal className="size-4" />,
  },
  {
    id: 'scraper',
    label: 'Logs do coletor',
    icon: <FileCode className="size-4" />,
  },
  {
    id: 'logs',
    label: 'Logs do sistema',
    icon: <FileText className="size-4" />,
  },
]

export function AdminSidebar({
  activeSubTab,
  onSelectSubTab,
  onOpenNewTrigger,
  onExitAdmin,
  isOpenMobile = false,
  onCloseMobile,
}: AdminSidebarProps) {
  return (
    <aside
      className={`fixed top-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-[#3f465c]/40 bg-[#131b2e] text-[#dae2fd] transition-transform duration-300 ${
        isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div className="mb-2 flex items-center justify-between border-b border-[#3f465c]/30 px-4 py-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#57dffe]">
            ODA Console
          </h1>
          <p className="mt-0.5 text-xs text-[#7c839b]">
            Administração da API ODA
          </p>
        </div>

        {onCloseMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1 text-[#7c839b] hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            ×
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive = activeSubTab === item.id

          return (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                onSelectSubTab(item.id)
                onCloseMobile?.()
              }}
              className={`flex w-full cursor-pointer items-center gap-3 rounded px-3 py-2.5 text-xs font-semibold tracking-wider uppercase transition-all duration-150 ${
                isActive
                  ? 'border-l-4 border-[#57dffe] bg-[#3f465c]/30 text-[#57dffe] shadow-xs'
                  : 'text-[#7c839b] hover:bg-[#3f465c]/15 hover:text-[#dae2fd]'
              }`}
            >
              <span className={isActive ? 'text-[#57dffe]' : 'text-[#7c839b]'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          )
        })}

        <div className="px-1 pt-4">
          <button
            type="button"
            onClick={onOpenNewTrigger}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#06b6d4] px-3 py-2.5 text-xs font-semibold text-white shadow-md transition-all duration-150 hover:bg-[#0891b2] active:scale-98"
          >
            <ListTodo className="size-4" />
            <span>Gerenciar filas</span>
          </button>
        </div>
      </nav>

      <div className="space-y-2 border-t border-[#3f465c]/30 p-3">
        <button
          type="button"
          onClick={onExitAdmin}
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs font-medium text-[#7c839b] transition-colors hover:bg-[#3f465c]/20 hover:text-white"
        >
          <ArrowLeft className="size-3.5 text-[#57dffe]" />
          <span>Voltar ao Portal ODA</span>
        </button>

        <div className="flex items-center justify-between px-2 text-[11px] text-[#7c839b]">
          <div className="flex items-center gap-1.5 hover:text-[#57dffe]">
            <ShieldCheck className="size-3.5" />
            <span>Segurança</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-[#57dffe]">
            <HelpCircle className="size-3.5" />
            <span>Suporte</span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3 rounded-lg border border-[#3f465c]/30 bg-[#0a101d]/60 p-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#57dffe]/40 bg-[#3f465c]/50 font-semibold text-[#57dffe]">
            A
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xs font-semibold text-[#dae2fd]">
              Administrador
            </span>
            <span className="truncate text-[10px] text-[#7c839b]">
              Acesso administrativo
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
