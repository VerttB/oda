import React from 'react';
import { Terminal, ExternalLink } from 'lucide-react';

interface ApiBannerProps {
  onExploreClick: () => void;
}

export const ApiBanner = () => {
  return (
    <section id="api-banner-section" className="bg-[#ecfeff] border-y border-dotted border-[#10b981] px-4 md:px-10 py-12 md:py-16">
      <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-2 text-[#10b981]">
            <Terminal className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Pensado para Desenvolvedores</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold text-[#0f172a] mb-3 tracking-tight">
            Construa com a API ODA
          </h2>
          <p className="text-base md:text-lg text-slate-600 max-w-2xl leading-relaxed">
            Acesse currículos parseados e dados estruturais de grupos de pesquisa diretamente através da nossa interface programática. Projetado para pesquisadores, instituições e cientistas de dados.
          </p>
        </div>

        <div className="shrink-0">
          <button
            id="explore-api-cta"
            className="bg-[#0f172a] text-white text-xs font-semibold uppercase tracking-wider px-8 py-4 hover:bg-[#1e293b] active:scale-95 transition-all flex items-center gap-2.5 shadow-lg rounded-lg cursor-pointer"
          >
            <span>Explorar Documentação da API</span>
            <ExternalLink className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </div>
    </section>
  );
};
