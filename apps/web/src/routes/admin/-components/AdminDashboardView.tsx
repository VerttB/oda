import React, { useState } from 'react'
import {
  BarChart3,
  PieChart,
  Receipt,
  Terminal,
  Download,
  ArrowRight,
} from 'lucide-react'
import type { AdminSubTab } from '../../../types'

interface AdminDashboardViewProps {
  onNavigateSubTab: (tab: AdminSubTab) => void
  onToast: (msg: string) => void
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onNavigateSubTab,
  onToast,
}) => {
  // Command Console state
  const [commandInput, setCommandInput] = useState('')
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    'ODA Terminal v2.1.0 initialized.',
    'Type "help" for a list of commands.',
    'admin@oda:~$ sys_status --verbose',
    '> All primary systems operational.',
    '> Load balancer healthy.',
  ])

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cmd = commandInput.trim().toLowerCase()
    if (!cmd) return

    const newLogs = [...consoleLogs, `admin@oda:~$ ${commandInput}`]

    switch (cmd) {
      case 'help':
        newLogs.push(
          '> Available commands: help, sys_status, routes, clear, ping, deploy, scrapers',
        )
        break
      case 'sys_status':
      case 'sys_status --verbose':
        newLogs.push(
          '> CPU: 18.4% | Memory: 4.2GB/16GB | Latency: 42ms | Cluster: us-east-1 OK',
        )
        break
      case 'routes':
        newLogs.push(
          '> 142 total endpoints active across /v1/researchers, /v1/publications, /v2/data',
        )
        break
      case 'ping':
        newLogs.push(
          '> PONG 64 bytes from api.oda.gov.br: icmp_seq=1 ttl=56 time=18.2 ms',
        )
        break
      case 'deploy':
        newLogs.push(
          '> Deploying latest git revision to master... Build #1049 passed.',
        )
        onToast('Deployment triggered from terminal')
        break
      case 'scrapers':
        newLogs.push(
          '> 3 scrapers configured: Academic Journals (Success), Gov Data (Running), Legacy (Failed)',
        )
        break
      case 'clear':
        setConsoleLogs(['ODA Terminal v2.1.0 ready.'])
        setCommandInput('')
        return
      default:
        newLogs.push(
          `> Command not recognized: "${cmd}". Type "help" for valid commands.`,
        )
    }

    setConsoleLogs(newLogs)
    setCommandInput('')
  }

  const handleExportLogs = () => {
    const logData = `Timestamp,Level,Message\n10:42:01,INFO,Node pool autoscale triggered.\n10:41:15,WARN,High latency detected on /v2/data endpoint.\n10:39:55,ERR,Database connection pool exhausted.\n10:38:10,INFO,Daily backup snapshot completed successfully.\n10:35:00,INFO,Service discovery updated.`
    const blob = new Blob([logData], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'oda_system_logs_export.csv'
    a.click()
    onToast('Exported system logs as CSV')
  }

  return (
    <div className="max-w-[1280px] mx-auto p-4 md:p-8 space-y-6">
      {/* Welcome & Summary Header */}
      <div>
        <h2 className="font-semibold text-2xl md:text-3xl text-[#1e293b] tracking-tight">
          System Overview
        </h2>
        <p className="text-sm md:text-base text-[#45464d] mt-1">
          Real-time metrics and command center for ODA Platform.
        </p>
      </div>

      {/* Main Grid: Analytics (Span 8) + Side Panel (Span 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Span 8) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Charts Container (2 cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top API Routes Bar Chart */}
            <div className="bg-white rounded-lg p-5 border border-[#c6c6cd]/50 shadow-2xs dotted-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1e293b] mb-4 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-[#06b6d4]" />
                <span>Top API Routes</span>
              </h3>

              {/* Bar Chart Bars */}
              <div className="h-44 flex items-end justify-between gap-3 px-2 pb-2 border-b border-[#e0f2fe] relative">
                {/* Bar 1 */}
                <div className="w-1/5 flex flex-col items-center group relative h-full justify-end">
                  <div className="absolute -top-7 bg-[#131b2e] text-white px-2 py-0.5 rounded text-[10px] hidden group-hover:block font-mono shadow-md z-10">
                    80k req
                  </div>
                  <div className="w-full bg-[#06b6d4] h-[80%] rounded-t hover:opacity-85 transition-opacity cursor-pointer" />
                </div>

                {/* Bar 2 */}
                <div className="w-1/5 flex flex-col items-center group relative h-full justify-end">
                  <div className="absolute -top-7 bg-[#131b2e] text-white px-2 py-0.5 rounded text-[10px] hidden group-hover:block font-mono shadow-md z-10">
                    65k req
                  </div>
                  <div className="w-full bg-[#10b981] h-[65%] rounded-t hover:opacity-85 transition-opacity cursor-pointer" />
                </div>

                {/* Bar 3 */}
                <div className="w-1/5 flex flex-col items-center group relative h-full justify-end">
                  <div className="absolute -top-7 bg-[#131b2e] text-white px-2 py-0.5 rounded text-[10px] hidden group-hover:block font-mono shadow-md z-10">
                    40k req
                  </div>
                  <div className="w-full bg-[#06b6d4] opacity-70 h-[40%] rounded-t hover:opacity-90 transition-opacity cursor-pointer" />
                </div>

                {/* Bar 4 */}
                <div className="w-1/5 flex flex-col items-center group relative h-full justify-end">
                  <div className="absolute -top-7 bg-[#131b2e] text-white px-2 py-0.5 rounded text-[10px] hidden group-hover:block font-mono shadow-md z-10">
                    90k req
                  </div>
                  <div className="w-full bg-[#10b981] h-[90%] rounded-t hover:opacity-85 transition-opacity cursor-pointer" />
                </div>

                {/* Bar 5 */}
                <div className="w-1/5 flex flex-col items-center group relative h-full justify-end">
                  <div className="absolute -top-7 bg-[#131b2e] text-white px-2 py-0.5 rounded text-[10px] hidden group-hover:block font-mono shadow-md z-10">
                    30k req
                  </div>
                  <div className="w-full bg-[#06b6d4] opacity-50 h-[30%] rounded-t hover:opacity-80 transition-opacity cursor-pointer" />
                </div>
              </div>

              {/* Bar Labels */}
              <div className="flex justify-between mt-2 font-mono text-[10px] text-[#45464d] px-1 overflow-x-auto">
                <span>/v1/users</span>
                <span>/v1/auth</span>
                <span>/v2/data</span>
                <span>/sys/logs</span>
                <span>/ping</span>
              </div>
            </div>

            {/* Most Accessed Demographics Doughnut */}
            <div className="bg-white rounded-lg p-5 border border-[#c6c6cd]/50 shadow-2xs dotted-border flex flex-col items-center justify-center relative">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1e293b] absolute top-5 left-5 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-[#10b981]" />
                <span>Access Demographics</span>
              </h3>

              {/* Doughnut Chart with Conic Gradient */}
              <div
                className="w-32 h-32 rounded-full mt-8 relative shadow-xs flex items-center justify-center"
                style={{
                  background:
                    'conic-gradient(#06b6d4 0% 45%, #10b981 45% 75%, #00687a 75% 100%)',
                }}
              >
                <div className="w-20 h-20 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                  <span className="font-bold text-xl text-[#1e293b] tracking-tight">
                    9.2k
                  </span>
                  <span className="text-[9px] text-[#45464d] uppercase font-semibold">
                    Requests/h
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex gap-4 mt-6 text-[11px] font-medium text-[#45464d]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" />
                  <span>Researchers (45%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span>Automated (30%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#00687a]" />
                  <span>Internal (25%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* System Logs Feed */}
          <div className="bg-white rounded-lg border border-[#c6c6cd]/50 shadow-2xs dotted-border overflow-hidden">
            <div className="px-5 py-3 border-b border-[#e0f2fe] bg-[#f8fafc] flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1e293b] flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-[#06b6d4]" />
                <span>Real-time System Logs</span>
              </h3>
              <button
                onClick={handleExportLogs}
                className="text-xs font-semibold uppercase tracking-wider text-[#06b6d4] hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Export</span>
              </button>
            </div>

            <div className="p-4 space-y-2.5 font-mono text-xs bg-[#f8fafc]/50 max-h-72 overflow-y-auto">
              <div className="flex gap-3 items-start pb-2 border-b border-[#e0f2fe]/60">
                <span className="text-[#45464d] w-16 shrink-0 text-[11px]">
                  10:42:01
                </span>
                <span className="text-[#10b981] font-bold w-14 shrink-0">
                  [INFO]
                </span>
                <span className="text-[#1e293b]">
                  Node pool autoscale triggered. Scaling up from 3 to 5
                  instances in region us-east-1.
                </span>
              </div>

              <div className="flex gap-3 items-start pb-2 border-b border-[#e0f2fe]/60">
                <span className="text-[#45464d] w-16 shrink-0 text-[11px]">
                  10:41:15
                </span>
                <span className="text-[#06b6d4] font-bold w-14 shrink-0">
                  [WARN]
                </span>
                <span className="text-[#1e293b]">
                  High latency detected on /v2/data endpoint. Avg response time
                  &gt; 500ms over last 2 minutes.
                </span>
              </div>

              <div className="flex gap-3 items-start pb-2 border-b border-[#ffdad6] bg-[#ffdad6]/30 px-2 py-1 -mx-2 rounded">
                <span className="text-[#ba1a1a] w-16 shrink-0 text-[11px]">
                  10:39:55
                </span>
                <span className="text-[#ba1a1a] font-bold w-14 shrink-0">
                  [ERR]
                </span>
                <span className="text-[#93000a]">
                  Database connection pool exhausted. Failed to acquire
                  connection for researcher query ID: 9942a.
                </span>
              </div>

              <div className="flex gap-3 items-start pb-2 border-b border-[#e0f2fe]/60">
                <span className="text-[#45464d] w-16 shrink-0 text-[11px]">
                  10:38:10
                </span>
                <span className="text-[#10b981] font-bold w-14 shrink-0">
                  [INFO]
                </span>
                <span className="text-[#1e293b]">
                  Daily backup snapshot completed successfully. Size: 1.4TB.
                </span>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-[#45464d] w-16 shrink-0 text-[11px]">
                  10:35:00
                </span>
                <span className="text-[#10b981] font-bold w-14 shrink-0">
                  [INFO]
                </span>
                <span className="text-[#1e293b]">
                  Service discovery updated. New API gateways registered.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Span 4) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Interactive Command Panel */}
          <div className="bg-[#0f172a] rounded-lg p-4 border-t-4 border-[#06b6d4] shadow-md flex flex-col h-[300px]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80 mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#06b6d4]" />
              <span>Command Console</span>
            </h3>

            {/* Terminal Feed */}
            <div className="flex-1 overflow-y-auto font-mono text-[12px] text-[#e2e8f0] space-y-1 mb-2 pr-1">
              {consoleLogs.map((log, idx) => {
                if (log.startsWith('admin@oda')) {
                  return (
                    <p key={idx}>
                      <span className="text-[#10b981]">admin@oda:~$</span>{' '}
                      {log.replace('admin@oda:~$ ', '')}
                    </p>
                  )
                }
                if (log.startsWith('>')) {
                  return (
                    <p key={idx} className="text-[#06b6d4] pl-2">
                      {log}
                    </p>
                  )
                }
                return (
                  <p key={idx} className="opacity-60 text-xs">
                    {log}
                  </p>
                )
              })}
            </div>

            {/* Command Input Box */}
            <form onSubmit={handleCommandSubmit} className="relative mt-auto">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#10b981] font-mono text-sm">
                &gt;
              </span>
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder="Type command (try 'help')..."
                className="w-full bg-[#1e293b] border border-[#334155] rounded text-[#e2e8f0] font-mono text-xs py-1.5 pl-7 pr-3 focus:outline-none focus:border-[#06b6d4]"
              />
            </form>
          </div>

          {/* Scraper Status Card */}
          <div className="bg-white rounded-lg p-5 border border-[#c6c6cd]/50 shadow-2xs dotted-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1e293b] mb-4 flex items-center gap-2">
              <Download className="w-4 h-4 text-[#06b6d4]" />
              <span>Latest Scraper Collections</span>
            </h3>

            <div className="space-y-4">
              {/* Status Item 1 */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#1e293b]">
                    Academic Journals V2
                  </p>
                  <p className="font-mono text-[10px] text-[#45464d]">
                    Started: 09:00 AM | Items: 12,450
                  </p>
                </div>
                <span className="bg-[#10b981]/15 text-[#10b981] text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />{' '}
                  Success
                </span>
              </div>

              {/* Status Item 2 */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#1e293b]">
                    Gov Data Portals
                  </p>
                  <p className="font-mono text-[10px] text-[#45464d]">
                    Started: 10:15 AM | Items: 3,210
                  </p>
                </div>
                <span className="bg-[#06b6d4]/15 text-[#00687a] text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse" />{' '}
                  Running
                </span>
              </div>

              {/* Status Item 3 */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#1e293b]">
                    Legacy Archives (Alpha)
                  </p>
                  <p className="font-mono text-[10px] text-[#45464d]">
                    Started: 08:30 AM | Items: --
                  </p>
                </div>
                <span className="bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]" />{' '}
                  Failed
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigateSubTab('scraper')}
              className="w-full mt-5 text-center text-xs font-semibold uppercase tracking-wider text-[#00687a] hover:text-[#06b6d4] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View All Collections</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
