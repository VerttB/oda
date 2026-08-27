import React from 'react';
import { FileText, Users, Network } from 'lucide-react';

interface MetricCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  id?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, value, label, id }) => {
  return (
    <div
      id={id}
      className="relative flex-1 flex flex-col items-center p-6 pb-2 bg-transparent border-b-2 border-border rounded-lg shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition-transform hover:-translate-y-1 duration-200 before:absolute before:left-2 before:bottom-0 before:h-1/8 before:w-0.5 before:rounded-md before:bg-border after:absolute after:right-2 after:bottom-0 after:h-1/8 after:w-0.5 after:rounded-md after:bg-border"
        >
      <div className="text-accent mb-3 text-3xl">
        {icon}
      </div>
      <div className="text-4xl md:text-5xl font-bold text-accent tracking-tight">
        {value}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2">
        {label}
      </div>
    </div>
  );
};

export const HeroMetrics: React.FC = () => {
  return (
    <section id="hero-gateway" className="bg-secondary pt-28 pb-16 px-4 md:px-10 text-center text-white">
      <div className="max-w-[1280px] mx-auto">
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-4 max-w-4xl mx-auto">
          Acesso Integrado ao Lattes e DGP

        </h1>
        <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Explore um conjunto abrangente de dados integrados da Plataforma Lattes e do Diretório de Grupos de Pesquisa (DGP), garantindo acesso transparente à produção acadêmica.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
          <MetricCard
            id="metric-curricula"
            icon={<FileText className="w-8 h-8" />}
            value="7.8M"
            label="Pesquisadores"
          />
          <MetricCard
            id="metric-groups"
            icon={<Users className="w-8 h-8" />}
            value="35K"
            label="Grupos de Pesquisa"
          />
          <MetricCard
            id="metric-publications"
            icon={<Network className="w-8 h-8" />}
            value="15.2M"
            label="Publicações Relacionadas"
          />
        </div>
      </div>
    </section>
  );
};
