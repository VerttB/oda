import { useState, type FC, type ReactNode } from 'react'
import { DocsSidebar, type DocsPage } from './DocsSidebar'

interface DocsLayoutProps {
  activePage: DocsPage
  children: ReactNode
}

export const DocsLayout: FC<DocsLayoutProps> = ({ activePage, children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <main className="min-h-screen bg-background pt-28">
      <div className="mx-auto flex w-full max-w-7xl items-start gap-8 px-4 pb-16 md:px-10">
        <DocsSidebar
          activePage={activePage}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() =>
            setIsSidebarCollapsed((isCollapsed) => !isCollapsed)
          }
        />

        {children}
      </div>
    </main>
  )
}
