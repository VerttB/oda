import { Button } from '#/components/ui/button'
import type { AcademicAuthor } from '#/core/interfaces'
import { User, UserCheck, Users } from 'lucide-react'
import type { FC } from 'react'

interface AcademicProductionAuthorsProps {
  authors: AcademicAuthor[]
  onSelectAuthor?: (author: AcademicAuthor) => void
}

export const AcademicProductionAuthors: FC<AcademicProductionAuthorsProps> = ({
  authors,
  onSelectAuthor,
}) => {
  return (
    <section className="bg-surface-container-lowest p-6 rounded-2xl dotted-border shadow-xs">
      <h2 className="text-xl font-bold text-primary mb-4 border-b border-border-subtle pb-3 flex items-center gap-2 tracking-tight">
        <Users className="w-5 h-5 text-secondary" />
        <span>Autores</span>
      </h2>

      <ul className="flex flex-wrap gap-3">
        {authors.map((author, index) => {
          const isExternal = author.isExternal

          if (isExternal) {
            return (
              <li key={index}>
                <span className="flex items-center gap-2 text-secondary bg-surface-container px-4 py-2 rounded-full border border-border-subtle text-sm">
                  <UserCheck className="w-4 h-4 text-secondary/80 flex-shrink-0" />
                  <span className="font-medium">
                    {author.name} (colaborador externo)
                  </span>
                </span>
              </li>
            )
          }

          return (
            <li key={index}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSelectAuthor && onSelectAuthor(author)}
                className="group rounded-full bg-surface-container-low font-medium text-secondary hover:border-accent-teal hover:bg-accent-teal/5 hover:text-accent-teal"
                title={`Ver perfil ou produções de ${author.name}`}
              >
                <User className="w-4 h-4 text-secondary group-hover:text-accent-teal transition-colors flex-shrink-0" />
                <span className="group-hover:underline">{author.name}</span>
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
