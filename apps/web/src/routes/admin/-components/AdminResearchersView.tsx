import React, { useState } from 'react'
import {
  ArrowUp,
  Filter,
  MoreVertical,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'

interface MonitoredProfile {
  id: string
  name: string
  institution: string
  lattesId: string
  lastScrape: string
  status: 'Up to date' | 'Syncing' | 'Error'
}

interface AdminResearchersViewProps {
  onToast: (msg: string) => void
  searchQuery?: string
}

export const AdminResearchersView: React.FC<AdminResearchersViewProps> = ({
  onToast,
  searchQuery = '',
}) => {
  const [filterStatus, setFilterStatus] = useState<
    'ALL' | 'Up to date' | 'Syncing' | 'Error'
  >('ALL')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const initialProfiles: MonitoredProfile[] = [
    {
      id: 'p-1',
      name: 'Dr. Elena Rostova',
      institution: 'Universidade de São Paulo',
      lattesId: '1928374650192837',
      lastScrape: '2 mins ago',
      status: 'Up to date',
    },
    {
      id: 'p-2',
      name: 'Prof. Carlos Mendes',
      institution: 'UNICAMP',
      lattesId: '5647382910475839',
      lastScrape: 'In progress',
      status: 'Syncing',
    },
    {
      id: 'p-3',
      name: 'Dr. Sarah Jenkins',
      institution: 'Federal University of Rio de Janeiro',
      lattesId: '9876543210987654',
      lastScrape: '1 hour ago',
      status: 'Error',
    },
    {
      id: 'p-4',
      name: 'Alan Turing Jr.',
      institution: 'UFMG',
      lattesId: '1122334455667788',
      lastScrape: 'Yesterday',
      status: 'Up to date',
    },
  ]

  const filteredProfiles = initialProfiles.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.institution.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.lattesId.includes(searchQuery)
    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const handleTriggerRescrape = (profile: MonitoredProfile) => {
    onToast(
      `Triggered scraping job for ${profile.name} (Lattes ID: ${profile.lattesId})`,
    )
    setActiveMenuId(null)
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1: Total Researchers */}
        <div className="bg-white border-2 border-dotted border-[#c6c6cd] rounded-lg p-6 relative overflow-hidden group shadow-2xs">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#57dffe]/15 rounded-full blur-xl group-hover:bg-[#57dffe]/25 transition-all pointer-events-none" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#45464d] mb-2">
            TOTAL RESEARCHERS
          </h3>
          <div className="flex items-end gap-3">
            <p className="font-bold text-3xl md:text-4xl text-[#141d21] tracking-tight">
              14,285
            </p>
            <span className="text-xs font-semibold text-[#009668] bg-[#4edea3]/20 px-2.5 py-1 rounded flex items-center gap-1 mb-1">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>12%</span>
            </span>
          </div>
        </div>

        {/* Metric 2: Pending Updates */}
        <div className="bg-white border-2 border-dotted border-[#c6c6cd] rounded-lg p-6 relative overflow-hidden group shadow-2xs">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#ffdad6]/40 rounded-full blur-xl group-hover:bg-[#ffdad6]/60 transition-all pointer-events-none" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#45464d] mb-2">
            PENDING UPDATES
          </h3>
          <div className="flex items-end gap-3">
            <p className="font-bold text-3xl md:text-4xl text-[#141d21] tracking-tight">
              342
            </p>
            <span className="text-xs font-medium text-[#45464d] mb-1">
              in queue
            </span>
          </div>
        </div>

        {/* Metric 3: Scraping Success Rate */}
        <div className="bg-white border-2 border-dotted border-[#c6c6cd] rounded-lg p-6 relative overflow-hidden group shadow-2xs">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#4edea3]/20 rounded-full blur-xl group-hover:bg-[#4edea3]/35 transition-all pointer-events-none" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#45464d] mb-2">
            SCRAPING SUCCESS RATE
          </h3>
          <div className="flex items-end gap-3 w-full">
            <p className="font-bold text-3xl md:text-4xl text-[#141d21] tracking-tight shrink-0">
              98.4%
            </p>
            <div className="w-full bg-[#e0e9ef] h-2.5 rounded-full mb-2 ml-2 overflow-hidden">
              <div
                className="bg-[#009668] h-2.5 rounded-full transition-all duration-500"
                style={{ width: '98.4%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Monitored Profiles Table Card */}
      <div className="bg-white border border-[#e0f2fe] rounded-lg shadow-2xs overflow-hidden">
        {/* Table Title & Filter Header */}
        <div className="px-6 py-4 border-b border-[#e0f2fe] flex justify-between items-center bg-[#ecf5fb]/50">
          <h3 className="font-semibold text-lg md:text-xl text-[#141d21]">
            Monitored Profiles
          </h3>

          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#00687a] hover:text-[#004e5c] cursor-pointer"
            >
              <Filter className="w-4 h-4" />
              <span>
                Filter {filterStatus !== 'ALL' ? `(${filterStatus})` : ''}
              </span>
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-36 bg-white rounded-lg shadow-lg border border-[#c6c6cd]/50 py-1 z-20 text-xs">
                <button
                  onClick={() => {
                    setFilterStatus('ALL')
                    setShowFilterDropdown(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#ecf5fb] font-medium"
                >
                  All Status
                </button>
                <button
                  onClick={() => {
                    setFilterStatus('Up to date')
                    setShowFilterDropdown(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#ecf5fb] font-medium"
                >
                  Up to date
                </button>
                <button
                  onClick={() => {
                    setFilterStatus('Syncing')
                    setShowFilterDropdown(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#ecf5fb] font-medium"
                >
                  Syncing
                </button>
                <button
                  onClick={() => {
                    setFilterStatus('Error')
                    setShowFilterDropdown(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#ecf5fb] font-medium text-[#ba1a1a]"
                >
                  Error
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f4faff] text-xs font-semibold uppercase tracking-wider text-[#45464d] border-b border-[#e0f2fe]">
                <th className="py-3.5 px-6 font-semibold">Researcher Name</th>
                <th className="py-3.5 px-6 font-semibold">Institution</th>
                <th className="py-3.5 px-6 font-semibold">Lattes ID</th>
                <th className="py-3.5 px-6 font-semibold">Last Scrape</th>
                <th className="py-3.5 px-6 font-semibold">Status</th>
                <th className="py-3.5 px-6 font-semibold text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#e0f2fe] text-xs text-[#141d21]">
              {filteredProfiles.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-[#ecf5fb]/50 transition-colors"
                >
                  <td className="py-4 px-6 font-semibold text-sm text-[#141d21]">
                    {p.name}
                  </td>
                  <td className="py-4 px-6 text-[#45464d]">{p.institution}</td>
                  <td className="py-4 px-6 font-mono text-[#45464d]">
                    {p.lattesId}
                  </td>
                  <td className="py-4 px-6 font-medium">{p.lastScrape}</td>
                  <td className="py-4 px-6">
                    {p.status === 'Up to date' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#4edea3]/20 text-[#009668] text-[11px] font-semibold tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-[#009668]" />
                        Up to date
                      </span>
                    )}
                    {p.status === 'Syncing' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#acedff]/40 text-[#006172] text-[11px] font-semibold tracking-wide">
                        <RefreshCw className="w-3 h-3 animate-spin text-[#00687a]" />
                        Syncing
                      </span>
                    )}
                    {p.status === 'Error' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#ffdad6] text-[#ba1a1a] text-[11px] font-semibold tracking-wide">
                        <AlertCircle className="w-3 h-3 text-[#ba1a1a]" />
                        Error
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right relative">
                    <button
                      onClick={() =>
                        setActiveMenuId(activeMenuId === p.id ? null : p.id)
                      }
                      className="p-1 text-[#45464d] hover:text-[#00687a] rounded hover:bg-[#e0e9ef] cursor-pointer"
                      title="Profile Options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === p.id && (
                      <div className="absolute right-6 top-10 w-44 bg-white rounded-lg shadow-lg border border-[#c6c6cd]/50 py-1.5 z-30 text-left text-xs">
                        <button
                          onClick={() => handleTriggerRescrape(p)}
                          className="w-full px-3 py-1.5 hover:bg-[#ecf5fb] text-[#141d21] flex items-center gap-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-[#00687a]" />
                          <span>Trigger Rescrape</span>
                        </button>
                        <button
                          onClick={() => {
                            onToast(`Opening CNPq Lattes: ${p.lattesId}`)
                            setActiveMenuId(null)
                          }}
                          className="w-full px-3 py-1.5 hover:bg-[#ecf5fb] text-[#141d21] flex items-center gap-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#45464d]" />
                          <span>View on Lattes</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-3 border-t border-[#e0f2fe] flex justify-between items-center bg-white text-xs text-[#45464d]">
          <span>Showing 1 to {filteredProfiles.length} of 14,285</span>
          <div className="flex gap-2">
            <button
              disabled
              className="px-3 py-1 border border-[#c6c6cd] rounded text-[#45464d] disabled:opacity-50 font-semibold cursor-not-allowed uppercase"
            >
              Prev
            </button>
            <button
              onClick={() => onToast('Loading next page of monitored profiles')}
              className="px-3 py-1 border border-[#c6c6cd] rounded text-[#45464d] hover:bg-[#ecf5fb] font-semibold cursor-pointer uppercase"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
