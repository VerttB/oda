import React, { useState } from 'react'
import {
  Network,
  Clock,
  Activity,
  AlertTriangle,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import type { AdminSubTab } from '../../../types'

interface AdminApiRoutesViewProps {
  onOpenNewRoute: () => void
  onNavigateSubTab: (tab: AdminSubTab) => void
  onToast: (msg: string) => void
  searchQuery?: string
}

interface RouteItem {
  id: string
  path: string
  description: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  status: 'Active' | 'Deprecated' | 'Maintenance'
  responseTime: string
  traffic: string
  sparkline: number[]
  isDeprecated?: boolean
}

export const AdminApiRoutesView: React.FC<AdminApiRoutesViewProps> = ({
  onOpenNewRoute,
  onNavigateSubTab,
  onToast,
  searchQuery = '',
}) => {
  const [filterMethod, setFilterMethod] = useState<'ALL' | 'GET' | 'POST'>(
    'ALL',
  )
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  const initialRoutes: RouteItem[] = [
    {
      id: 'r-1',
      path: '/v1/researchers',
      description: 'Primary researcher index',
      method: 'GET',
      status: 'Active',
      responseTime: '32ms',
      traffic: '145k',
      sparkline: [40, 60, 30, 80, 50, 90, 100],
    },
    {
      id: 'r-2',
      path: '/v1/researchers',
      description: 'Create new researcher profile',
      method: 'POST',
      status: 'Active',
      responseTime: '128ms',
      traffic: '12k',
      sparkline: [20, 30, 25, 40, 35, 45, 30],
    },
    {
      id: 'r-3',
      path: '/v0/groups',
      description: 'Legacy group lookup',
      method: 'GET',
      status: 'Deprecated',
      responseTime: '85ms',
      traffic: '1.2k',
      sparkline: [60, 50, 40, 30, 20, 10, 5],
      isDeprecated: true,
    },
    {
      id: 'r-4',
      path: '/v1/publications',
      description: 'Fetch publication metadata',
      method: 'GET',
      status: 'Active',
      responseTime: '56ms',
      traffic: '89k',
      sparkline: [45, 65, 55, 85, 75, 95, 80],
    },
  ]

  const filteredRoutes = initialRoutes.filter((r) => {
    const matchesSearch =
      r.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesMethod = filterMethod === 'ALL' || r.method === filterMethod
    return matchesSearch && matchesMethod
  })

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-semibold text-3xl md:text-4xl text-[#000000] tracking-tight">
            API Routes
          </h2>
          <p className="text-sm md:text-base text-[#45464d] mt-2 max-w-2xl">
            Manage and monitor endpoint configurations, usage metrics, and
            deployment statuses across the Open DGP ecosystem.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider bg-white border border-[#c6c6cd] px-4 py-2 rounded-lg hover:bg-[#ecf5fb] transition-colors text-[#141d21] shadow-2xs cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-[#00687a]" />
              <span>
                Filter {filterMethod !== 'ALL' ? `(${filterMethod})` : ''}
              </span>
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-[#c6c6cd]/50 py-1 z-20 text-xs">
                <button
                  onClick={() => {
                    setFilterMethod('ALL')
                    setShowFilterDropdown(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#ecf5fb] font-medium"
                >
                  All Methods
                </button>
                <button
                  onClick={() => {
                    setFilterMethod('GET')
                    setShowFilterDropdown(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#ecf5fb] font-medium"
                >
                  GET Only
                </button>
                <button
                  onClick={() => {
                    setFilterMethod('POST')
                    setShowFilterDropdown(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#ecf5fb] font-medium"
                >
                  POST Only
                </button>
              </div>
            )}
          </div>

          {/* New Route Button */}
          <button
            onClick={onOpenNewRoute}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider bg-[#00687a] hover:bg-[#004e5c] text-white px-4 py-2 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Route</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Routes */}
        <div className="bg-white p-5 rounded-xl border border-[#c6c6cd]/60 shadow-2xs relative overflow-hidden group hover:border-[#00687a] transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#00687a]" />
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#45464d]">
              Total Routes
            </span>
            <Network className="w-5 h-5 text-[#00687a] opacity-80" />
          </div>
          <div className="text-3xl font-bold text-[#000000] tracking-tight">
            142
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-[#009668] font-medium">
            <span>↑</span>
            <span>+12 this week</span>
          </div>
        </div>

        {/* Card 2: Avg Response Time */}
        <div className="bg-white p-5 rounded-xl border border-[#c6c6cd]/60 shadow-2xs relative overflow-hidden group hover:border-[#00687a] transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#4edea3]" />
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#45464d]">
              Avg Response Time
            </span>
            <Clock className="w-5 h-5 text-[#4edea3] opacity-80" />
          </div>
          <div className="text-3xl font-bold text-[#000000] tracking-tight">
            45
            <span className="text-base text-[#45464d] ml-1 font-normal">
              ms
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-[#009668] font-medium">
            <span>↓</span>
            <span>-5ms vs last week</span>
          </div>
        </div>

        {/* Card 3: Total Requests */}
        <div className="bg-white p-5 rounded-xl border border-[#c6c6cd]/60 shadow-2xs relative overflow-hidden group hover:border-[#00687a] transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#57dffe]" />
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#45464d]">
              Total Requests (24h)
            </span>
            <Activity className="w-5 h-5 text-[#00687a] opacity-80" />
          </div>
          <div className="text-3xl font-bold text-[#000000] tracking-tight">
            2.4
            <span className="text-base text-[#45464d] ml-1 font-normal">M</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-[#45464d] font-medium">
            <span>—</span>
            <span>Stable</span>
          </div>
        </div>

        {/* Card 4: Error Rate */}
        <div className="bg-white p-5 rounded-xl border border-[#c6c6cd]/60 shadow-2xs relative overflow-hidden group hover:border-[#ba1a1a] transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#ba1a1a]" />
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#45464d]">
              Error Rate
            </span>
            <AlertTriangle className="w-5 h-5 text-[#ba1a1a] opacity-80" />
          </div>
          <div className="text-3xl font-bold text-[#000000] tracking-tight">
            0.12
            <span className="text-base text-[#45464d] ml-1 font-normal">%</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-[#ba1a1a] font-medium">
            <span>↑</span>
            <span>+0.02% vs yesterday</span>
          </div>
        </div>
      </div>

      {/* Route List / Data Cards Table */}
      <div className="bg-white border border-[#c6c6cd]/60 rounded-xl shadow-2xs overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3.5 bg-[#e6eff5] border-b border-[#c6c6cd]/50 text-xs font-semibold uppercase tracking-wider text-[#45464d] items-center">
          <div className="col-span-4">Endpoint</div>
          <div className="col-span-2">Method</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Response Time</div>
          <div className="col-span-2 text-right">Traffic (24h)</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-[#c6c6cd]/30">
          {filteredRoutes.map((route) => (
            <div
              key={route.id}
              onClick={() =>
                onToast(
                  `Selected route endpoint ${route.path} (${route.method})`,
                )
              }
              className={`grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-[#ecf5fb] transition-colors cursor-pointer group ${
                route.isDeprecated
                  ? 'bg-[#ecf5fb]/50 border-l-4 border-l-[#ba1a1a]'
                  : ''
              }`}
            >
              {/* Endpoint */}
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded flex items-center justify-center transition-colors shrink-0 ${
                    route.isDeprecated
                      ? 'bg-[#e0e9ef] text-[#45464d]'
                      : 'bg-[#57dffe]/20 text-[#006172] group-hover:bg-[#00687a] group-hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div
                    className={`font-mono text-xs font-semibold text-[#000000] truncate ${
                      route.isDeprecated ? 'line-through text-[#45464d]' : ''
                    }`}
                  >
                    {route.path}
                  </div>
                  <div className="text-[11px] text-[#45464d] truncate">
                    {route.description}
                  </div>
                </div>
              </div>

              {/* Method */}
              <div className="col-span-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    route.method === 'GET'
                      ? 'bg-[#00687a]/10 text-[#00687a] border-[#00687a]/20'
                      : 'bg-[#009668]/10 text-[#009668] border-[#009668]/20'
                  }`}
                >
                  {route.method}
                </span>
              </div>

              {/* Status */}
              <div className="col-span-2">
                {route.status === 'Active' ? (
                  <span className="inline-flex items-center gap-1.5 text-[#009668] text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#4edea3]" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[#45464d] text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#76777d]" />
                    Deprecated
                  </span>
                )}
              </div>

              {/* Response Time */}
              <div className="col-span-2 font-mono text-xs text-[#141d21]">
                {route.responseTime}
              </div>

              {/* Traffic (24h) + Sparkline */}
              <div className="col-span-2 flex items-center justify-end gap-3">
                <div className="font-mono text-xs text-[#141d21] font-semibold">
                  {route.traffic}
                </div>
                <div className="flex items-end gap-0.5 h-6 w-16 opacity-75 group-hover:opacity-100 transition-opacity">
                  {route.sparkline.map((val, sIdx) => (
                    <div
                      key={sIdx}
                      style={{ height: `${val}%` }}
                      className={`w-1.5 rounded-t-xs ${
                        route.isDeprecated
                          ? 'bg-[#76777d]'
                          : sIdx === route.sparkline.length - 1
                            ? 'bg-[#00687a]'
                            : 'bg-[#57dffe]'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-3 bg-[#ecf5fb] border-t border-[#c6c6cd]/50 flex justify-between items-center text-xs text-[#45464d]">
          <span>Showing 1-{filteredRoutes.length} of 142 routes</span>
          <div className="flex gap-2">
            <button
              disabled
              className="p-1 rounded border border-[#c6c6cd] text-[#45464d] opacity-50 cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onToast('Displaying next page of routes')}
              className="p-1 rounded border border-[#c6c6cd] text-[#45464d] hover:bg-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bento Grid Extra Info (System Status & Recent Deployments) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* System Status Card (Span 1) */}
        <div className="col-span-1 border border-dashed border-[#c6c6cd] rounded-lg bg-white p-6 relative overflow-hidden shadow-2xs">
          <div className="absolute top-0 right-0 w-28 h-28 bg-[#57dffe]/10 rounded-full blur-2xl pointer-events-none" />
          <h3 className="font-semibold text-lg text-[#000000] mb-4">
            System Status
          </h3>
          <div className="space-y-3.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-medium text-[#141d21]">API Gateway</span>
              <span className="inline-flex items-center gap-1.5 text-[#009668] font-semibold text-[11px]">
                <span className="w-2 h-2 rounded-full bg-[#4edea3]" />{' '}
                Operational
              </span>
            </div>
            <div className="h-px bg-[#c6c6cd]/30" />
            <div className="flex justify-between items-center">
              <span className="font-medium text-[#141d21]">Auth Service</span>
              <span className="inline-flex items-center gap-1.5 text-[#009668] font-semibold text-[11px]">
                <span className="w-2 h-2 rounded-full bg-[#4edea3]" />{' '}
                Operational
              </span>
            </div>
            <div className="h-px bg-[#c6c6cd]/30" />
            <div className="flex justify-between items-center">
              <span className="font-medium text-[#141d21]">Rate Limiter</span>
              <span className="inline-flex items-center gap-1.5 text-[#00687a] font-semibold text-[11px]">
                <span className="w-2 h-2 rounded-full bg-[#acedff]" /> High Load
              </span>
            </div>
          </div>
        </div>

        {/* Recent Deployments Card (Span 2) */}
        <div className="col-span-1 md:col-span-2 border border-dashed border-[#c6c6cd] rounded-lg bg-white p-6 relative overflow-hidden shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg text-[#000000]">
              Recent Deployments
            </h3>
            <button
              onClick={() => onNavigateSubTab('logs')}
              className="text-xs font-semibold text-[#00687a] hover:underline cursor-pointer"
            >
              View All Logs
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-[#f4faff] p-3 rounded border border-[#c6c6cd]/40">
              <div className="w-2 h-2 rounded-full bg-[#4edea3] shrink-0" />
              <div className="font-mono text-[11px] text-[#45464d] w-20 shrink-0">
                10:42 AM
              </div>
              <div className="text-xs text-[#141d21] flex-1">
                Updated rate limits on{' '}
                <span className="font-mono bg-[#e0e9ef] px-1.5 py-0.5 rounded text-[11px]">
                  /v1/researchers
                </span>
              </div>
              <div className="text-[10px] font-semibold text-[#45464d] bg-[#e6eff5] px-2 py-0.5 rounded border border-[#c6c6cd]/30">
                Admin.User
              </div>
            </div>

            <div className="flex items-center gap-3 bg-[#f4faff] p-3 rounded border border-[#c6c6cd]/40">
              <div className="w-2 h-2 rounded-full bg-[#4edea3] shrink-0" />
              <div className="font-mono text-[11px] text-[#45464d] w-20 shrink-0">
                Yesterday
              </div>
              <div className="text-xs text-[#141d21] flex-1">
                Deprecated endpoint{' '}
                <span className="font-mono bg-[#e0e9ef] px-1.5 py-0.5 rounded text-[11px]">
                  /v0/groups
                </span>
              </div>
              <div className="text-[10px] font-semibold text-[#45464d] bg-[#e6eff5] px-2 py-0.5 rounded border border-[#c6c6cd]/30">
                System
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
