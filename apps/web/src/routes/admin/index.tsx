import { createFileRoute } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { clearAuthToken, getAuthToken } from '#/api/auth'
import { Button } from '#/components/ui/button'
import { AdminConsolePage } from './-components/AdminConsolePage'
import { AdminLoginPage } from './-components/AdminLoginPage'

export const Route = createFileRoute('/admin/')({ component: AdminRoute })
function AdminRoute() {
  const navigate = Route.useNavigate()
  const [isReady, setIsReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    setIsAuthenticated(Boolean(getAuthToken()))
    setIsReady(true)
    const expired = () => setIsAuthenticated(false)
    window.addEventListener('oda:auth-expired', expired)
    return () => window.removeEventListener('oda:auth-expired', expired)
  }, [])
  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }
  if (!isReady) return <main className="min-h-screen bg-surface" />
  if (!isAuthenticated)
    return <AdminLoginPage onAuthenticated={() => setIsAuthenticated(true)} />
  return (
    <>
      <AdminConsolePage
        onExitAdmin={() => void navigate({ to: '/' })}
        onToast={showToast}
      />
      <div className="fixed bottom-4 left-4 z-[70] md:bottom-auto md:left-auto md:right-4 md:top-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            clearAuthToken()
            setIsAuthenticated(false)
          }}
        >
          <LogOut className="size-4" />
          Sair
        </Button>
      </div>
      {toast && (
        <div className="fixed bottom-4 right-4 z-[90] rounded-md bg-secondary px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}
