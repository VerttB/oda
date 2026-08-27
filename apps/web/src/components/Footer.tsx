import React from 'react';

interface FooterProps {
  onTabChange?: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onTabChange }) => {
  return (
    <footer id="main-footer" className="bg-[#e6eff5] w-full mt-auto border-t border-[#e0f2fe] py-8 px-4 md:px-10">
      <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#00687a] block mb-1">
            © 2024 ODA Platform. All rights reserved.
          </span>
          <p className="text-xs text-slate-500">
            Open DGP API & Lattes Integration Knowledge Graph.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 md:gap-6 text-sm text-[#00687a]">
          <button
            onClick={() => alert('Citation Policy: All metadata sourced from CNPq Lattes and DGP repositories are indexed under academic open-access FAIR data protocols.')}
            className="hover:text-[#0f172a] transition-colors cursor-pointer text-left"
          >
            Citation Policy
          </button>
          <button
            onClick={() => alert('Privacy Protocol: Personal identifiers conform to national scientific transparency guidelines with automated anonymization of sensitive metadata.')}
            className="hover:text-[#0f172a] transition-colors cursor-pointer text-left"
          >
            Privacy Protocol
          </button>
          <button
            onClick={() => alert('Institutional Access: University federations can request high-throughput batch extraction tokens via verified academic SAML/Eduroam credentials.')}
            className="hover:text-[#0f172a] transition-colors cursor-pointer text-left"
          >
            Institutional Access
          </button>
          <button
            onClick={() => onTabChange?.('docs')}
            className="hover:text-[#0f172a] font-medium transition-colors cursor-pointer text-left"
          >
            API Documentation
          </button>
          <button
            onClick={() => alert('Contact Support: For inquiries or data corrections, reach out to contact@oda-platform.org')}
            className="hover:text-[#0f172a] transition-colors cursor-pointer text-left"
          >
            Contact Support
          </button>
        </div>
      </div>
    </footer>
  );
};
