import { AlignLeft, Check, Copy } from 'lucide-react'
import { useState, type FC } from 'react'

interface AcademicProductionAbstractProps {
  abstract: string
}

export const AcademicProductionAbstract: FC<AcademicProductionAbstractProps> = ({
  abstract
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    void navigator.clipboard.writeText(abstract)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className=" p-6 rounded-2xl border-l-4 shadow-xs relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-accent-teal"></div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-primary flex items-center gap-2 tracking-tight">
          <AlignLeft className="w-5 h-5 text-accent-teal" />
          <span>Resumo</span>
        </h2>

        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-semibold text-secondary hover:text-accent-teal flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle hover:bg-surface-container transition-colors cursor-pointer"
          title="Copiar texto do resumo"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar resumo</span>
            </>
          )}
        </button>
      </div>

      <p className="text-base text-black leading-relaxed text-justify font-normal">
        {abstract}
      </p>
    </section>
  )
}
