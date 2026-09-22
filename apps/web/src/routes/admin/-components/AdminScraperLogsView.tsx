import React, { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Filter,
  RefreshCw,
  Info,
} from 'lucide-react'

interface ScraperLogItem {
  id: string
  jobId: string
  name: string
  status: 'Success' | 'Partial' | 'Failed'
  timeAgo: string
  targetSource: string
  startTime: string
  duration: string
  itemsProcessed: string
  warning?: string
  error?: string
}

interface AdminScraperLogsViewProps {
  onToast: (msg: string) => void
  searchQuery?: string
}

export const AdminScraperLogsView: React.FC<AdminScraperLogsViewProps> = ({
  onToast,
  searchQuery = '',
}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'Success' | 'Partial' | 'Failed'
  >('ALL')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  const initialLogs: ScraperLogItem[] = [
    {
      id: 's-1',
      jobId: '8829A-X9',
      name: 'Lattes CV Scraper',
      status: 'Success',
      timeAgo: '2 mins ago',
      targetSource: 'Lattes Platform',
      startTime: '14:32:05 BRT',
      duration: '45s',
      itemsProcessed: '1,245',
    },
    {
      id: 's-2',
      jobId: '7710B-Y2',
      name: 'CNPq Grant Extractor',
      status: 'Partial',
      timeAgo: '1 hour ago',
      targetSource: 'CNPq Database',
      startTime: '13:15:00 BRT',
      duration: '2m 10s',
      itemsProcessed: '890 / 950',
      warning:
        'Warning: 60 records skipped due to malformed XML structure on target endpoint.',
    },
    {
      id: 's-3',
      jobId: '6699C-Z1',
      name: 'Sucupira Integration',
      status: 'Failed',
      timeAgo: '3 hours ago',
      targetSource: 'Sucupira Platform',
      startTime: '11:00:00 BRT',
      duration: '15s',
      itemsProcessed: '0',
      error:
        'ERR_CONNECTION_TIMEOUT: Target server failed to respond within 15000ms. Code: 504.',
    },
  ]

  const handleRunNow = () => {
    setIsRunning(true)
    onToast(
      'Dispatched immediate scraping cycle across all registered endpoints...',
    )
    setTimeout(() => {
      setIsRunning(false)
      onToast('Scraper cycle completed. 1,420 records ingested successfully.')
    }, 2000)
  }

  const filteredLogs = initialLogs.filter((item) => {
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.jobId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.targetSource.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  return (
    <div className="max-w-[1280px] mx-auto p-4 md:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#c6c6cd]/40 pb-4">
        <div>
          <h2 className="font-semibold text-3xl md:text-4xl text-[#1e293b] tracking-tight">
            Scraper Logs
          </h2>
          <p className="text-sm md:text-base text-[#45464d] mt-1">
            Monitor and manage automated data extraction pipelines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 border border-[#c6c6cd] px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-[#141d21] hover:border-[#00687a] hover:text-[#00687a] transition-colors bg-white shadow-2xs cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>
                Filter {statusFilter !== 'ALL' ? `(${statusFilter})` : ''}
              </span>
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-36 bg-white rounded-lg shadow-lg border border-[#c6c6cd]/50 py-1 z-20 text-xs">
                <button
                  onClick={() => {
                    setStatusFilter('ALL')
                    setShowFilterDropdown(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#ecf5fb] font-medium"
                >
                  All Status
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('Success')
                    setShowFilterDropdown(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#ecf5fb] font-medium text-[#009668]"
                >
                  Success Only
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('Partial')
                    setShowFilterDropdown(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#ecf5fb] font-medium text-[#00687a]"
                >
                  Partial Success
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('Failed')
                    setShowFilterDropdown(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#ecf5fb] font-medium text-[#ba1a1a]"
                >
                  Failed Only
                </button>
              </div>
            )}
          </div>

          {/* Run Now Button */}
          <button
            onClick={handleRunNow}
            disabled={isRunning}
            className="flex items-center gap-2 bg-[#00687a] hover:bg-[#004e5c] text-white px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-xs group cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isRunning
                  ? 'animate-spin'
                  : 'group-hover:rotate-180 transition-transform duration-300'
              }`}
            />
            <span>{isRunning ? 'Running...' : 'Run Now'}</span>
          </button>
        </div>
      </div>

      {/* Log Entries List */}
      <div className="space-y-4">
        {filteredLogs.map((log) => {
          if (log.status === 'Success') {
            return (
              <div
                key={log.id}
                className="bg-white border-2 border-dotted border-[#c6c6cd] rounded-lg p-6 hover:border-[#00687a] transition-colors group shadow-2xs"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#4edea3]/20 text-[#009668] p-2 rounded-md">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-[#1e293b]">
                        {log.name}
                      </h3>
                      <p className="font-mono text-xs text-[#45464d] mt-0.5">
                        JOB-ID: {log.jobId}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#4edea3]/20 text-[#009668] border border-[#009668]/30">
                      Success
                    </span>
                    <p className="text-xs text-[#45464d] mt-1">{log.timeAgo}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#e6eff5] p-4 rounded-md border border-[#c6c6cd]/50 text-xs">
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-[#45464d] text-[10px] mb-1">
                      Target Source
                    </p>
                    <p className="font-medium text-[#1e293b]">
                      {log.targetSource}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-[#45464d] text-[10px] mb-1">
                      Start Time
                    </p>
                    <p className="font-medium text-[#1e293b]">
                      {log.startTime}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-[#45464d] text-[10px] mb-1">
                      Duration
                    </p>
                    <p className="font-medium text-[#1e293b]">{log.duration}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-[#45464d] text-[10px] mb-1">
                      Items Processed
                    </p>
                    <p className="font-mono font-bold text-[#00687a]">
                      {log.itemsProcessed}
                    </p>
                  </div>
                </div>
              </div>
            )
          }

          if (log.status === 'Partial') {
            return (
              <div
                key={log.id}
                className="bg-white border-2 border-dotted border-[#c6c6cd] rounded-lg p-6 hover:border-[#00687a] transition-colors group shadow-2xs"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#57dffe]/20 text-[#006172] p-2 rounded-md">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-[#1e293b]">
                        {log.name}
                      </h3>
                      <p className="font-mono text-xs text-[#45464d] mt-0.5">
                        JOB-ID: {log.jobId}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#57dffe]/20 text-[#006172] border border-[#57dffe]">
                      Partial Success
                    </span>
                    <p className="text-xs text-[#45464d] mt-1">{log.timeAgo}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#e6eff5] p-4 rounded-md border border-[#c6c6cd]/50 text-xs">
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-[#45464d] text-[10px] mb-1">
                      Target Source
                    </p>
                    <p className="font-medium text-[#1e293b]">
                      {log.targetSource}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-[#45464d] text-[10px] mb-1">
                      Start Time
                    </p>
                    <p className="font-medium text-[#1e293b]">
                      {log.startTime}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-[#45464d] text-[10px] mb-1">
                      Duration
                    </p>
                    <p className="font-medium text-[#1e293b]">{log.duration}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-[#45464d] text-[10px] mb-1">
                      Items Processed
                    </p>
                    <p className="font-mono font-bold text-[#00687a]">
                      {log.itemsProcessed}
                    </p>
                  </div>
                </div>

                {log.warning && (
                  <div className="mt-4 text-xs text-[#45464d] bg-[#ecf5fb] p-3 rounded border border-[#c6c6cd]/30 flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#006172] shrink-0 mt-0.5" />
                    <span>{log.warning}</span>
                  </div>
                )}
              </div>
            )
          }

          // Failed
          return (
            <div
              key={log.id}
              className="bg-white border-2 border-dotted border-[#ffdad6] rounded-lg p-6 hover:border-[#ba1a1a] transition-colors group shadow-2xs"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-[#ffdad6] text-[#ba1a1a] p-2 rounded-md">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-[#1e293b]">
                      {log.name}
                    </h3>
                    <p className="font-mono text-xs text-[#45464d] mt-0.5">
                      JOB-ID: {log.jobId}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a]/30">
                    Failed
                  </span>
                  <p className="text-xs text-[#45464d] mt-1">{log.timeAgo}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#e6eff5] p-4 rounded-md border border-[#ffdad6] text-xs">
                <div>
                  <p className="font-semibold uppercase tracking-wider text-[#45464d] text-[10px] mb-1">
                    Target Source
                  </p>
                  <p className="font-medium text-[#1e293b]">
                    {log.targetSource}
                  </p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wider text-[#45464d] text-[10px] mb-1">
                    Start Time
                  </p>
                  <p className="font-medium text-[#1e293b]">{log.startTime}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wider text-[#45464d] text-[10px] mb-1">
                    Duration
                  </p>
                  <p className="font-medium text-[#1e293b]">{log.duration}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wider text-[#45464d] text-[10px] mb-1">
                    Items Processed
                  </p>
                  <p className="font-mono font-bold text-[#ba1a1a]">
                    {log.itemsProcessed}
                  </p>
                </div>
              </div>

              {log.error && (
                <div className="mt-4 font-mono text-xs text-[#93000a] bg-[#ffdad6]/40 p-3 rounded border border-[#ffdad6]">
                  {log.error}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      <div className="mt-8 flex justify-between items-center border-t border-[#c6c6cd]/40 pt-4 text-xs text-[#45464d]">
        <span>Showing 1 to {filteredLogs.length} of 124 logs</span>
        <div className="flex gap-2">
          <button
            disabled
            className="px-3 py-1 border border-[#c6c6cd] rounded text-[#45464d] hover:bg-[#e0e9ef] transition-colors disabled:opacity-50 font-semibold cursor-not-allowed uppercase"
          >
            Previous
          </button>
          <button
            onClick={() => onToast('Loading next page of scraper logs')}
            className="px-3 py-1 border border-[#c6c6cd] rounded text-[#141d21] hover:bg-[#ecf5fb] transition-colors font-semibold cursor-pointer uppercase"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
