import {
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Hash,
  Info,
  ShieldCheck,
} from 'lucide-react'
import { useState, type FC, type MouseEvent } from 'react'

interface AcademicProductionMetadataProps {
  journal: string
  issn: string
  doi: string
  qualis: string
  qualisArea: string
  pages: string
  groupName?: string
  institution?: string
  citationsCount?: number
}

export const AcademicProductionMetadata: FC<
  AcademicProductionMetadataProps
> = ({
  journal,
  issn,
  doi,
  qualis,
  qualisArea,
  pages,
  groupName,
  institution,
  citationsCount = 0,
}) => {
  const [copiedDoi, setCopiedDoi] = useState(false)
  const hasDoi = Boolean(doi && doi !== 'Não informado')

  const handleCopyDoi = (event: MouseEvent) => {
    event.preventDefault()

    if (!hasDoi) {
      return
    }

    void navigator.clipboard.writeText(`https://doi.org/${doi}`)
    setCopiedDoi(true)
    window.setTimeout(() => setCopiedDoi(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xs">
      <h3 className="mb-4 flex items-center gap-2 border-b border-border-subtle pb-3 text-xl font-bold tracking-tight text-primary">
        <Info className="h-5 w-5 text-secondary" />
        <span>Metadados técnicos</span>
      </h3>

      <dl className="flex flex-col gap-3">
        <div className="flex flex-col rounded-xl bg-surface-container-low p-3">
          <dt className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-secondary">
            <BookOpen className="h-3.5 w-3.5 text-secondary" />
            <span>Periódico</span>
          </dt>
          <dd className="text-sm font-semibold text-primary">{journal}</dd>
        </div>

        <div className="flex flex-col rounded-xl bg-surface-container-low p-3">
          <dt className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-secondary">
            <Hash className="h-3.5 w-3.5 text-secondary" />
            <span>ISSN</span>
          </dt>
          <dd className="font-mono text-xs font-medium text-primary">{issn}</dd>
        </div>

        <div className="flex flex-col rounded-xl bg-surface-container-low p-3">
          <dt className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-secondary">
            <span>DOI</span>
            <button
              type="button"
              onClick={handleCopyDoi}
              disabled={!hasDoi}
              className="flex cursor-pointer items-center gap-1 text-[11px] font-normal text-secondary hover:text-accent-teal disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copiedDoi ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  <span className="text-emerald-700">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copiar link</span>
                </>
              )}
            </button>
          </dt>
          <dd className="break-all font-mono text-xs text-accent-teal">
            {hasDoi ? (
              <a
                href={`https://doi.org/${doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium hover:underline"
              >
                <span>{doi}</span>
                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
              </a>
            ) : (
              <span className="text-secondary">Não informado</span>
            )}
          </dd>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-xl bg-surface-container-low p-3">
          <div className="absolute bottom-0 right-0 top-0 flex w-12 items-center justify-center bg-emerald-500/10">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <dt className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-secondary">
            Classificação Qualis (CAPES)
          </dt>
          <dd className="flex items-center gap-3 pr-10">
            <span className="rounded-md bg-emerald-400 px-3 py-1 text-base font-bold text-emerald-950 shadow-2xs">
              {qualis}
            </span>
            <span className="text-xs font-medium leading-tight text-secondary">
              {qualisArea}
            </span>
          </dd>
        </div>

        <div className="flex flex-col rounded-xl bg-surface-container-low p-3">
          <dt className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-secondary">
            <FileSpreadsheet className="h-3.5 w-3.5 text-secondary" />
            <span>Páginas</span>
          </dt>
          <dd className="font-mono text-xs font-medium text-primary">
            {pages}
          </dd>
        </div>

        <div className="flex flex-col rounded-xl bg-surface-container-low p-3">
          <dt className="mb-1 text-[11px] font-bold uppercase tracking-wider text-secondary">
            Citações rastreadas
          </dt>
          <dd className="text-sm font-bold text-accent-indigo">
            {citationsCount} citações registradas
          </dd>
        </div>

        {(groupName || institution) && (
          <div className="flex flex-col rounded-xl bg-surface-container-low p-3">
            <dt className="mb-1 text-[11px] font-bold uppercase tracking-wider text-secondary">
              Vínculo institucional
            </dt>
            {groupName && (
              <dd className="mb-0.5 text-xs font-semibold text-primary">
                {groupName}
              </dd>
            )}
            {institution && (
              <dd className="text-xs text-secondary">{institution}</dd>
            )}
          </div>
        )}
      </dl>
    </div>
  )
}
