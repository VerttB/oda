import { LockKeyhole, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { login } from '#/api/auth'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'

type AdminLoginPageProps = { onAuthenticated: () => void }

export function AdminLoginPage({ onAuthenticated }: AdminLoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login({ username: username.trim(), password })
      onAuthenticated()
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Não foi possível entrar.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <section className="w-full max-w-sm rounded-lg border border-border-subtle bg-background p-6 shadow-lg sm:p-8">
        <div className="mb-6 flex size-11 items-center justify-center rounded-lg bg-primary text-white">
          <LockKeyhole className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold text-primary">
          Acesso administrativo
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre com suas credenciais para acessar o painel.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-foreground">
            Usuário
            <Input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1.5"
              required
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Senha
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5"
              required
            />
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            fullWidth
            disabled={isSubmitting || !username.trim() || !password}
          >
            <LogIn className="size-4" />
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </section>
    </main>
  )
}
