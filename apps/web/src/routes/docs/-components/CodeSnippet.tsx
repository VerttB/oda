import { Check, Copy, Play, Terminal } from 'lucide-react'
import { useState, type FC } from 'react'

interface CodeSnippetBoxProps {
  title: string
  language: 'bash' | 'python' | 'json'
  code: string
  onTryItOut?: () => void
}

export const CodeSnippetBox: FC<CodeSnippetBoxProps> = ({
  title,
  language,
  code,
  onTryItOut,
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    void navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/70 bg-surface-dark text-slate-100 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-2.5 font-mono text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Terminal className="h-4 w-4 text-accent" />
          <span className="font-semibold">{title}</span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onTryItOut && (
            <button
              type="button"
              onClick={onTryItOut}
              className="flex cursor-pointer items-center gap-1 rounded bg-accent/20 px-2 py-0.5 text-[11px] text-accent transition-colors hover:bg-accent/30"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Executar</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            title="Copiar trecho de código"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-accent" />
                <span className="text-accent">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-200 md:text-sm">
        <pre className="m-0 font-mono selection:bg-accent/40">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}
