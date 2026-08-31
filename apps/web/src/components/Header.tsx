import React, { useState } from 'react'
import { Search, X, ArrowRight } from 'lucide-react'

interface NavbarProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  isDarkTheme?: boolean
}

export const Header: React.FC<NavbarProps> = ({
  activeTab = 'discover',
  onTabChange = () => {},
  searchQuery = '',
  onSearchChange = () => {},
  isDarkTheme = false,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const navItems: { id: string; label: string }[] = [
    { id: 'discover', label: 'Discover' },
    { id: 'groups', label: 'Groups' },
    { id: 'publications', label: 'Publications' },
    { id: 'institutions', label: 'Institutions' },
    { id: 'docs', label: 'API Docs' },
  ]

  const isNavyNav = activeTab === 'discover' || isDarkTheme

  return (
    <header
      id="top-navbar"
      className={`fixed top-0 w-full z-50 transition-colors duration-200 ${
        isNavyNav
          ? 'bg-secondary border-b border-secondary text-white'
          : 'bg-white border-b border-border-subtle text-secondary shadow-xs'
      }`}
    >
      <div className="max-w-[1280px] mx-auto flex justify-between items-center h-[72px] md:h-[80px] px-4 md:px-8">
        {/* Brand & Search */}
        <div className="flex items-center gap-6">
          <button
            id="brand-logo"
            onClick={() => onTabChange('discover')}
            className={`font-semibold text-2xl md:text-3xl tracking-tight transition-transform hover:opacity-90 flex items-center gap-2 ${
              isNavyNav ? 'text-white' : 'text-secondary'
            }`}
          >
            <span>ODA</span>
          </button>

          {/* Search Input */}
          <div
            className={`hidden md:flex items-center px-3.5 py-1.5 rounded-lg border transition-all w-[280px] lg:w-[320px] ${
              isNavyNav
                ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-within:border-accent focus-within:bg-white/15'
                : 'bg-slate-50 border-border-subtle text-foreground placeholder:text-muted-foreground focus-within:border-secondary focus-within:bg-white'
            }`}
          >
            <Search
              className={`w-4 h-4 mr-2.5 shrink-0 ${isNavyNav ? 'text-white/70' : 'text-muted-foreground'}`}
            />
            <input
              id="global-search-input"
              type="text"
              placeholder="Procurar Pesquisadores, Grupos, Publicações..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-transparent border-none focus:outline-hidden text-sm w-full p-0 font-normal"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="text-xs p-1 hover:opacity-80 rounded-full"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8">
          {navItems.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`text-sm md:text-base font-medium transition-all relative py-1 cursor-pointer ${
                  isActive
                    ? isNavyNav
                      ? 'text-white font-semibold border-b-2 border-white'
                      : 'text-secondary font-semibold border-b-2 border-secondary'
                    : isNavyNav
                      ? 'text-white/70 hover:text-white'
                      : 'text-muted-foreground hover:text-secondary'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3 md:gap-4 relative">
          {/* Notification Button */}

          {/* Profile Button */}
          <div className="relative">
            <button
              id="profile-btn"
              onClick={() => {
                setUserMenuOpen(!userMenuOpen)
              }}
              className={`p-1.5 rounded-full transition-colors flex items-center gap-2 cursor-pointer ${
                isNavyNav
                  ? 'text-white/80 hover:text-white hover:bg-white/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-slate-100'
              }`}
              title="Researcher Account"
            >
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7pIzfuk-eLdC6Nxn0ePVr_99DzfWdGIpClj5V6n4AnFHnvAMLY0s76dXJhh9N1nf-zzcKOm7aFpPmR9G4zSoOdp_VR3DN2B6PlTRJZrfMKOOgv2S3Zlbp5QyzGPEJ4J2MbuaolT4Sm8UccsUncpmh4zVNS2ANfUsZHkjTcEJoWO2DBMCVKaw4JYCOkqKV4RVAae6n38Fcq6hSX7mjOgeRsFAZIHpCs28O_BqqLc-w7G5ayrwdc48_"
                alt="Account profile avatar"
                className="w-8 h-8 rounded-full object-cover border border-accent"
              />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white text-foreground rounded-xl shadow-xl border border-border-subtle p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="font-semibold text-secondary">
                    Dr. Elena Rostova
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    elena.rostova@mit.edu
                  </p>
                </div>
                <button
                  onClick={() => {
                    onTabChange('publications')
                    setUserMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-md font-medium text-slate-700 flex items-center justify-between"
                >
                  <span>My Researcher Profile</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => {
                    onTabChange('groups')
                    setUserMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-md font-medium text-slate-700 flex items-center justify-between"
                >
                  <span>My DGP Groups</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => {
                    onTabChange('docs')
                    setUserMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-md font-medium text-slate-700 flex items-center justify-between"
                >
                  <span>API Keys & Docs</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex items-center overflow-x-auto px-4 py-2 border-t border-white/10 gap-3 text-xs">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`whitespace-nowrap px-3 py-1 rounded-full font-medium transition-colors ${
              activeTab === item.id
                ? isNavyNav
                  ? 'bg-white text-secondary font-semibold'
                  : 'bg-secondary text-white font-semibold'
                : isNavyNav
                  ? 'text-white/70 bg-white/10'
                  : 'text-muted-foreground bg-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  )
}
