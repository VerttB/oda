import React from 'react'
import { HelpCircle, Globe, Mail, Share2 } from 'lucide-react'

interface ContactInfoProps {
  website: string
  email: string
  socialHandle: string
}

export const ContactInfo: React.FC<ContactInfoProps> = ({
  website,
  email,
  socialHandle,
}) => {
  const hasContactInfo = Boolean(website || email || socialHandle)

  return (
    <section
      id="contact-info"
      className="rounded-lg border-2 border-dotted border-accent/50 bg-surface-card p-6 shadow-[0_4px_12px_rgba(15,23,42,0.03)]"
    >
      <div className="mb-4 flex items-center gap-2 text-primary">
        <HelpCircle className="w-5 h-5" />
        <h3 className="text-xl font-semibold text-secondary">
          Informações de Contato
        </h3>
      </div>

      {hasContactInfo ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg p-2 text-foreground transition-colors hover:bg-slate-50 hover:text-accent-hover"
            >
              <div className="rounded-md bg-primary-50 p-2 text-primary">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Portal Web
                </div>
                <span className="text-base font-medium">Website do Grupo</span>
              </div>
            </a>
          )}

          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-3 rounded-lg p-2 text-foreground transition-colors hover:bg-slate-50 hover:text-accent-hover"
            >
              <div className="rounded-md bg-primary-50 p-2 text-primary">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Contato Direto
                </div>
                <span className="text-base font-medium">{email}</span>
              </div>
            </a>
          )}

          {socialHandle && (
            <div className="flex items-center gap-3 rounded-lg p-2 text-foreground hover:bg-slate-50">
              <div className="rounded-md bg-primary-50 p-2 text-primary">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Localização Institucional
                </div>
                <span className="text-base font-medium">{socialHandle}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma informação de contato disponível.
        </p>
      )}
    </section>
  )
}
