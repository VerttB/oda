import React from 'react'

interface FooterProps {
  onTabChange?: (tab: string) => void
}

export const Footer: React.FC<FooterProps> = ({ onTabChange }) => {
  return (
    <footer
      id="main-footer"
      className="bg-[#e6eff5] w-full mt-auto border-t border-[#e0f2fe] py-8 px-4 md:px-10"
    >
      <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#00687a] block mb-1">
            © 2024 Plataforma ODA. Todos os direitos reservados.
          </span>
          <p className="text-xs text-slate-500">
            API aberta do DGP e grafo de conhecimento integrado ao Lattes.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 md:gap-6 text-sm text-[#00687a]">
          <button
            onClick={() =>
              alert(
                'Política de citação: todos os metadados oriundos dos repositórios CNPq Lattes e DGP são indexados sob protocolos acadêmicos FAIR de dados abertos.',
              )
            }
            className="hover:text-[#0f172a] transition-colors cursor-pointer text-left"
          >
            Política de citação
          </button>
          <button
            onClick={() =>
              alert(
                'Protocolo de privacidade: identificadores pessoais seguem diretrizes nacionais de transparência científica com anonimização automatizada de metadados sensíveis.',
              )
            }
            className="hover:text-[#0f172a] transition-colors cursor-pointer text-left"
          >
            Protocolo de privacidade
          </button>
          <button
            onClick={() =>
              alert(
                'Acesso institucional: federações universitárias podem solicitar tokens de extração em lote mediante credenciais acadêmicas verificadas via SAML/Eduroam.',
              )
            }
            className="hover:text-[#0f172a] transition-colors cursor-pointer text-left"
          >
            Acesso institucional
          </button>
          <button
            onClick={() => onTabChange?.('docs')}
            className="hover:text-[#0f172a] font-medium transition-colors cursor-pointer text-left"
          >
            Documentação da API
          </button>
          <button
            onClick={() =>
              alert(
                'Suporte: para dúvidas ou correções de dados, entre em contato pelo e-mail contact@oda-platform.org',
              )
            }
            className="hover:text-[#0f172a] transition-colors cursor-pointer text-left"
          >
            Contatar suporte
          </button>
        </div>
      </div>
    </footer>
  )
}
