import React, { useState } from 'react'
import {
  Filter,
  PauseCircle,
  PlayCircle,
  Download,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react'

interface LogItem {
  id: string
  timestamp: string
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR'
  service: string
  message: string
  stackTrace?: string[]
  expanded?: boolean
}

interface AdminSystemLogsViewProps {
  onToast: (msg: string) => void
  searchQuery?: string
}

export const AdminSystemLogsView: React.FC<AdminSystemLogsViewProps> = ({
  onToast,
  searchQuery = '',
}) => {
  const [isPaused, setIsPaused] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<
    'ALL' | 'INFO' | 'DEBUG' | 'WARN' | 'ERROR'
  >('ALL')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  const [logs, setLogs] = useState<LogItem[]>([
    {
      id: 'log-1',
      timestamp: '2023-10-27 14:32:01.104',
      level: 'INFO',
      service: 'UserAuthenticationService',
      message: 'Successfully authenticated session id xxxx-xxxx-492a',
    },
    {
      id: 'log-2',
      timestamp: '2023-10-27 14:32:01.882',
      level: 'DEBUG',
      service: 'DatabaseConnectionPool',
      message: 'Releasing idle connection back to pool. Current active: 4',
    },
    {
      id: 'log-3',
      timestamp: '2023-10-27 14:32:05.410',
      level: 'WARN',
      service: 'RateLimiter',
      message:
        'API quota approaching threshold for clientId: prod-web-client (90%)',
    },
    {
      id: 'log-4',
      timestamp: '2023-10-27 14:32:08.991',
      level: 'ERROR',
      service: 'PaymentProcessingService',
      message: 'Connection timeout while contacting gateway endpoint.',
      expanded: true,
      stackTrace: [
        'java.net.SocketTimeoutException: Read timed out',
        '    at java.base/sun.nio.ch.NioSocketImpl.timedRead(NioSocketImpl.java:283)',
        '    at java.base/sun.nio.ch.NioSocketImpl.implRead(NioSocketImpl.java:309)',
        '    at java.base/sun.nio.ch.NioSocketImpl.read(NioSocketImpl.java:350)',
        '    at java.base/sun.nio.ch.NioSocketImpl$1.read(NioSocketImpl.java:803)',
        '    at java.base/java.net.Socket$SocketInputStream.read(Socket.java:981)',
        '    at org.apache.http.impl.io.SessionInputBufferImpl.streamRead(SessionInputBufferImpl.java:137)',
        '    at com.oda.services.payment.GatewayClient.executeCharge(GatewayClient.java:142)',
      ],
    },
    {
      id: 'log-5',
      timestamp: '2023-10-27 14:32:12.005',
      level: 'INFO',
      service: 'JobScheduler',
      message: "Batch process 'NightlyDataSync' initiated by system.",
    },
  ])

  const toggleExpand = (id: string) => {
    setLogs((prev) =>
      prev.map((log) =>
        log.id === id ? { ...log, expanded: !log.expanded } : log,
      ),
    )
  }

  const handleExportCsv = () => {
    const csvContent =
      'Timestamp,Level,Service,Message\n' +
      logs
        .map(
          (l) =>
            `"${l.timestamp}","${l.level}","${l.service}","${l.message.replace(/"/g, '""')}"`,
        )
        .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `oda_system_logs_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    onToast('Exported system logs as CSV')
  }

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = selectedLevel === 'ALL' || log.level === selectedLevel
    const matchesSearch =
      searchQuery === '' ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.timestamp.includes(searchQuery)
    return matchesLevel && matchesSearch
  })

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6">
      {/* Page Header & Stream Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#c6c6cd]/30 pb-4">
        <div>
          <h1 className="font-semibold text-3xl md:text-4xl text-[#1e293b] tracking-tight">
            System Logs
          </h1>
          <p className="text-sm md:text-base text-[#45464d] mt-1">
            Live monitoring and diagnostic stream for backend services.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter Levels Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 border border-[#c6c6cd] rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-[#ecf5fb] transition-colors bg-white text-[#141d21] shadow-2xs cursor-pointer"
            >
              <Filter className="w-4 h-4 text-[#00687a]" />
              <span>
                {selectedLevel === 'ALL'
                  ? 'Filter Levels'
                  : `Level: ${selectedLevel}`}
              </span>
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-36 bg-white rounded-lg shadow-lg border border-[#c6c6cd]/50 py-1 z-20 text-xs">
                {(['ALL', 'INFO', 'DEBUG', 'WARN', 'ERROR'] as const).map(
                  (lvl) => (
                    <button
                      key={lvl}
                      onClick={() => {
                        setSelectedLevel(lvl)
                        setShowFilterDropdown(false)
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#ecf5fb] font-medium flex items-center justify-between"
                    >
                      <span>{lvl}</span>
                      {selectedLevel === lvl && (
                        <Check className="w-3.5 h-3.5 text-[#00687a]" />
                      )}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Pause / Resume Button */}
          <button
            onClick={() => {
              setIsPaused(!isPaused)
              onToast(isPaused ? 'Resumed live log streaming' : 'Stream paused')
            }}
            className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-2xs cursor-pointer ${
              isPaused
                ? 'border-[#10b981] text-[#10b981] bg-[#10b981]/10'
                : 'border-[#ffdad6] text-[#ba1a1a] bg-white hover:bg-[#ffdad6]/20'
            }`}
          >
            {isPaused ? (
              <>
                <PlayCircle className="w-4 h-4" />
                <span>Resume Stream</span>
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4" />
                <span>Pause Stream</span>
              </>
            )}
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-[#131b2e] text-[#57dffe] rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-[#131b2e]/90 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Log Terminal Window */}
      <div className="bg-[#131b2e] rounded-lg border border-[#76777d] shadow-md overflow-hidden flex flex-col min-h-[600px] h-[calc(100vh-260px)]">
        {/* Terminal Header */}
        <div className="bg-[#565e74]/20 border-b border-[#c6c6cd]/20 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isPaused ? 'bg-amber-400' : 'bg-[#57dffe] animate-pulse'
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd]">
              {isPaused ? 'Live Stream Paused' : 'Live Stream Connected'}
            </span>
          </div>

          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ffdad6]/60 border border-[#ba1a1a]" />
            <div className="w-3 h-3 rounded-full bg-[#acedff]/60 border border-[#4cd7f6]" />
            <div className="w-3 h-3 rounded-full bg-[#6ffbbe]/60 border border-[#4edea3]" />
          </div>
        </div>

        {/* Log Stream Body */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2 select-text">
          {filteredLogs.map((log) => {
            const isError = log.level === 'ERROR'

            if (isError) {
              return (
                <div
                  key={log.id}
                  className="group flex flex-col gap-2 p-2.5 rounded bg-[#ffdad6]/10 border border-[#ba1a1a]/30"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-[#dae2fd]/50 whitespace-nowrap text-[11px] shrink-0">
                      {log.timestamp}
                    </span>
                    <span className="text-[#ba1a1a] font-bold w-16 shrink-0">
                      [ERROR]
                    </span>
                    <span className="text-[#ffdad6] flex-1 break-all">
                      <span className="font-semibold text-white/90">
                        {log.service}
                      </span>{' '}
                      - {log.message}
                    </span>
                    {log.stackTrace && (
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="text-[#dae2fd]/60 hover:text-white p-1"
                        title={
                          log.expanded
                            ? 'Recolher stack trace'
                            : 'Expandir stack trace'
                        }
                      >
                        {log.expanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expanded Stack Trace */}
                  {log.expanded && log.stackTrace && (
                    <div className="ml-0 sm:ml-24 p-3 bg-[#000000] rounded border border-[#c6c6cd]/20 text-[#dae2fd]/80 text-[11px] overflow-x-auto">
                      <pre>
                        <code>{log.stackTrace.join('\n')}</code>
                      </pre>
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div
                key={log.id}
                className="group flex items-start gap-4 p-2 rounded hover:bg-[#565e74]/15 border border-transparent hover:border-[#c6c6cd]/20 transition-colors"
              >
                <span className="text-[#dae2fd]/50 whitespace-nowrap text-[11px] shrink-0">
                  {log.timestamp}
                </span>

                {log.level === 'INFO' && (
                  <span className="text-[#acedff] font-bold w-16 shrink-0">
                    [INFO]
                  </span>
                )}
                {log.level === 'DEBUG' && (
                  <span className="text-[#c6c6cd] font-bold w-16 shrink-0">
                    [DEBUG]
                  </span>
                )}
                {log.level === 'WARN' && (
                  <span className="text-[#6ffbbe] font-bold w-16 shrink-0">
                    [WARN]
                  </span>
                )}

                <span className="text-[#dae2fd]/80 flex-1 break-all">
                  <span className="font-semibold text-[#dae2fd]">
                    {log.service}
                  </span>{' '}
                  - {log.message}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
