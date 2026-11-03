import { useCallback, useEffect, useState } from 'react'
import { AiRequestError } from '#/api/ai'

// Compartilhado pelas duas interfaces; a cota efetiva continua sendo aplicada na API.
export function useAiCooldown() {
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(0)
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  useEffect(() => {
    if (!deadline) return
    setNow(Date.now())
    const timer = window.setInterval(() => {
      const time = Date.now()
      setNow(time)
      if (time >= deadline) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [deadline])
  const reportError = useCallback((error: unknown) => {
    if (error instanceof AiRequestError && error.retryAt) {
      const retryAt = error.retryAt
      setNow(Date.now())
      setDeadline((previous) => Math.max(previous, retryAt))
    }
  }, [])
  return { seconds, reportError }
}
