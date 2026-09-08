import { ArrowLeft, CheckCircle2, FileText, LockOpen } from 'lucide-react'
import type { FC } from 'react'

interface AcademicProductionHeaderProps {
  type: string
  year: number | string
  title: string
  onBack?: () => void
  isOpenAccess?: boolean
}

export const AcademicProductionHeader: FC<AcademicProductionHeaderProps> = ({
  type,
  year,
  title,
  onBack,
  isOpenAccess = true,
}) => {
  return (
    <header className="md:col-span-12 mb-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-accent-teal transition-colors mb-4 cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Voltar para produções acadêmicas</span>
        </button>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="bg-[#ecfeff] border border-[#a5f3fc] text-[#006172] px-3 py-1 rounded-lg font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
          <FileText className="w-3.5 h-3.5 text-[#0891b2]" />
          <span>{type}</span>
        </span>

        <span className="text-secondary font-mono text-xs px-2.5 py-1 bg-surface-container rounded-lg font-semibold">
          {year}
        </span>

        {isOpenAccess && (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
            <LockOpen className="w-3 h-3 text-emerald-600" />
            <span>Acesso aberto</span>
          </span>
        )}

        <span className="text-xs text-secondary/80 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-accent-teal" />
          <span>Indexação ODA verificada</span>
        </span>
      </div>

      <h1 className="text-2xl md:text-3xl lg:text-[32px] font-bold text-primary tracking-tight leading-snug">
        {title}
      </h1>
    </header>
  )
}
