import { createFileRoute } from '@tanstack/react-router'

import { GeneralDocsContent } from './-components/DocsContent'
import { DocsLayout } from './-components/DocsLayout'

export const Route = createFileRoute('/docs/')({
  component: DocsRoute,
})

function DocsRoute() {
  return (
    <DocsLayout activePage="geral">
      <GeneralDocsContent />
    </DocsLayout>
  )
}
