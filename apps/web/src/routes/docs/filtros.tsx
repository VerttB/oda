import { createFileRoute } from '@tanstack/react-router'

import { FiltersDocsContent } from './-components/DocsContent'
import { DocsLayout } from './-components/DocsLayout'

export const Route = createFileRoute('/docs/filtros')({
  component: DocsFiltersRoute,
})

function DocsFiltersRoute() {
  return (
    <DocsLayout activePage="filtros">
      <FiltersDocsContent />
    </DocsLayout>
  )
}
