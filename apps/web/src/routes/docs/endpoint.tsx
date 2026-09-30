import { createFileRoute } from '@tanstack/react-router'

import { EndpointsDocsContent } from './-components/DocsContent'
import { DocsLayout } from './-components/DocsLayout'

export const Route = createFileRoute('/docs/endpoint')({
  component: DocsEndpointRoute,
})

function DocsEndpointRoute() {
  return (
    <DocsLayout activePage="endpoint">
      <EndpointsDocsContent />
    </DocsLayout>
  )
}
