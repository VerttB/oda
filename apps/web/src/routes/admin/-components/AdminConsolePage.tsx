import { useState } from 'react'
import type { AdminSubTab } from '../../../types'
import { AdminApiRoutesView } from './AdminApiRoutesView'
import { AdminCommandConsoleView } from './AdminCommandConsoleView'
import { AdminQueuesView } from './AdminQueuesView'
import { AdminResearchersView } from './AdminResearchersView'
import { AdminSidebar } from './AdminSidebar'
import { AdminTopAppBar } from './AdminTopAppBar'
import { AdminPipelineView } from './AdminPipelineView'

interface Props {
  onExitAdmin: () => void
  onToast: (message: string) => void
  initialSubTab?: AdminSubTab
}
export function AdminConsolePage({
  onExitAdmin,
  onToast,
  initialSubTab = 'dashboard',
}: Props) {
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>(initialSubTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  function selectSubTab(tab: AdminSubTab) {
    setActiveSubTab(tab)
    setSearchQuery('')
    setIsMobileMenuOpen(false)
  }
  return (
    <div className="flex min-h-screen bg-[#f4faff] font-sans text-[#141d21] antialiased">
      <AdminSidebar
        activeSubTab={activeSubTab}
        onSelectSubTab={selectSubTab}
        onOpenNewTrigger={() => selectSubTab('queues')}
        onExitAdmin={onExitAdmin}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex min-h-screen min-w-0 w-full flex-1 flex-col md:ml-64">
        <AdminTopAppBar
          activeSubTab={activeSubTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onToast={onToast}
          onOpenSettings={() =>
            onToast('Preferências administrativas atualizadas.')
          }
        />
        <main className="flex-1 overflow-y-auto bg-[#f4faff]">
          {activeSubTab === 'dashboard' && (
            <AdminPipelineView
              onToast={onToast}
              searchQuery={searchQuery}
            />
          )}
          {activeSubTab === 'queues' && <AdminQueuesView onToast={onToast} />}
          {activeSubTab === 'routes' && (
            <AdminApiRoutesView
              onOpenNewRoute={() => selectSubTab('queues')}
              onNavigateSubTab={selectSubTab}
              onToast={onToast}
              searchQuery={searchQuery}
            />
          )}
          {activeSubTab === 'researchers' && (
            <AdminResearchersView onToast={onToast} searchQuery={searchQuery} />
          )}
          {activeSubTab === 'logs' && (
            <AdminPipelineView onToast={onToast} searchQuery={searchQuery} />
          )}
          {activeSubTab === 'console' && (
            <AdminCommandConsoleView
              onToast={onToast}
              searchQuery={searchQuery}
            />
          )}
          {activeSubTab === 'scraper' && (
            <AdminPipelineView onToast={onToast} searchQuery={searchQuery} />
          )}
        </main>
      </div>
    </div>
  )
}
