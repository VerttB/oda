import { SlidersHorizontal, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '#/components/ui/button'

type FilterModalProps = {
  children: ReactNode
  isOpen: boolean
  onApply: () => void
  onClose: () => void
  onReset: () => void
}

function FilterModal({ children, isOpen, onApply, onClose, onReset }: FilterModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true" aria-label="Mais filtros">
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-lg bg-background shadow-xl sm:max-w-2xl sm:rounded-lg">
        <header className="sticky top-0 flex items-center justify-between border-b border-border-subtle bg-background px-5 py-4">
          <div className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-secondary" /><h2 className="text-base font-semibold text-primary">Mais filtros</h2></div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} title="Fechar filtros"><X className="size-4" /></Button>
        </header>
        <div className="grid gap-5 p-5 sm:grid-cols-2">{children}</div>
        <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-border-subtle bg-background px-5 py-4">
          <Button type="button" variant="outline" size="sm" onClick={onReset}>Limpar</Button>
          <Button type="button" size="sm" onClick={() => { onApply(); onClose() }}>Aplicar filtros</Button>
        </footer>
      </div>
    </div>
  )
}

export { FilterModal }
