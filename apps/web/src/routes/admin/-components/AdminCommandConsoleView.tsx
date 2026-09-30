import React, { useState, useRef, useEffect } from 'react'
import { Terminal, Trash2 } from 'lucide-react'

interface TerminalLine {
  id: string
  type: 'system' | 'info' | 'command' | 'output'
  timestamp?: string
  tag?: string
  content: string
  isPreformatted?: boolean
}

interface AdminCommandConsoleViewProps {
  onToast: (msg: string) => void
  searchQuery?: string
}

export const AdminCommandConsoleView: React.FC<
  AdminCommandConsoleViewProps
> = ({ onToast }) => {
  const [commandInput, setCommandInput] = useState('')
  const terminalEndRef = useRef<HTMLDivElement>(null)

  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'l-1',
      type: 'system',
      timestamp: '[10:42:01]',
      tag: 'SYSTEM:',
      content: 'Initialization complete. Connected to primary daemon.',
    },
    {
      id: 'l-2',
      type: 'info',
      timestamp: '[10:42:05]',
      tag: 'INFO:',
      content: 'Loading available modules... 42 loaded.',
    },
    {
      id: 'l-3',
      type: 'command',
      timestamp: '[10:45:12]',
      content: 'status_check --all',
    },
    {
      id: 'l-4',
      type: 'output',
      content:
        'NODE_1: Online (98% uptime)\nNODE_2: Online (99% uptime)\nDB_CLUSTER: Syncing (Lag: 4ms)\nSCRAPER_QUEUE: Idle',
      isPreformatted: true,
    },
  ])

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  const handleClear = () => {
    setLines([
      {
        id: `clear-${Date.now()}`,
        type: 'info',
        timestamp: `[${new Date().toLocaleTimeString('pt-BR')}]`,
        tag: 'INFO:',
        content: 'Terminal buffer cleared. Ready.',
      },
    ])
    onToast('Console output cleared')
  }

  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault()
    const cmd = commandInput.trim()
    if (!cmd) return

    const timeStr = `[${new Date().toLocaleTimeString('pt-BR')}]`

    // Add command input line
    const newCommand: TerminalLine = {
      id: `cmd-${Date.now()}`,
      type: 'command',
      timestamp: timeStr,
      content: cmd,
    }

    let responseContent: TerminalLine

    const lower = cmd.toLowerCase()
    if (lower === 'clear') {
      handleClear()
      setCommandInput('')
      return
    } else if (lower.startsWith('scrape_trigger')) {
      responseContent = {
        id: `resp-${Date.now()}`,
        type: 'output',
        content:
          'TRIGGER SUCCESS: Task registered in active queue.\nSpawning worker process pid: 14820.\nSyncing CNPq Lattes registry... Ingested 145 profiles.\nStatus: Completed.',
        isPreformatted: true,
      }
      onToast('Triggered scraping cycle successfully')
    } else if (lower.startsWith('sys_reboot')) {
      responseContent = {
        id: `resp-${Date.now()}`,
        type: 'output',
        content:
          'REBOOT PROTOCOL INITIATED:\nStopping ingress connections on selected node...\nGracefully recycling worker thread pool...\nNode restarted successfully in 840ms. Healthcheck: 200 OK.',
        isPreformatted: true,
      }
      onToast('Node reboot executed successfully')
    } else if (lower.startsWith('log_tail')) {
      responseContent = {
        id: `resp-${Date.now()}`,
        type: 'output',
        content:
          '[TAIL] 200 OK GET /v1/researchers 32ms\n[TAIL] 200 OK POST /v1/publications 45ms\n[TAIL] 204 NO CONTENT DELETE /v0/groups 18ms\n[TAIL] Stream attached. Listening...',
        isPreformatted: true,
      }
    } else if (lower.startsWith('status_check')) {
      responseContent = {
        id: `resp-${Date.now()}`,
        type: 'output',
        content:
          'NODE_1: Online (99.8% uptime)\nNODE_2: Online (99.9% uptime)\nDB_CLUSTER: Syncing (Lag: 2ms)\nSCRAPER_QUEUE: 0 pending tasks\nAPI_GATEWAY: Operational (Latency 45ms)',
        isPreformatted: true,
      }
    } else if (lower === 'help') {
      responseContent = {
        id: `resp-${Date.now()}`,
        type: 'output',
        content:
          'AVAILABLE SHELL COMMANDS:\n  scrape_trigger --id <task_id> [--force] : Run automated extraction pipeline\n  sys_reboot --node <name>                : Gracefully restart cluster nodes\n  log_tail --service <api|db|worker>      : Real-time service output stream\n  status_check [--all]                    : Inspect cluster and replica health\n  clear                                   : Wipe current console output\n  help                                    : Display command reference index',
        isPreformatted: true,
      }
    } else {
      responseContent = {
        id: `resp-${Date.now()}`,
        type: 'output',
        content: `oda-sh: command not recognized: "${cmd}". Type "help" to see valid commands.`,
      }
    }

    setLines((prev) => [...prev, newCommand, responseContent])
    setCommandInput('')
  }

  const handleCommandRefClick = (template: string) => {
    setCommandInput(template)
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col lg:flex-row gap-6">
      {/* Terminal Area */}
      <div className="flex-1 flex flex-col bg-[#131b2e] rounded-lg border border-[#c6c6cd] shadow-sm overflow-hidden h-[calc(100vh-10rem)] min-h-[580px]">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0a101d] border-b border-[#565e74]/40">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#57dffe]" />
            <span className="font-mono text-xs text-[#bec6e0]">
              ODA System Shell v2.4.1
            </span>
          </div>

          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1 rounded border border-[#565e74] text-[#bec6e0] hover:text-white hover:border-[#c6c6cd] transition-colors font-mono text-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Console</span>
          </button>
        </div>

        {/* Terminal Output */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-[#bec6e0] space-y-2 bg-[#0f172a] select-text">
          {lines.map((l) => {
            if (l.type === 'system') {
              return (
                <div key={l.id} className="flex gap-3">
                  <span className="text-[#565e74] shrink-0">{l.timestamp}</span>
                  <span className="text-[#4edea3] font-bold shrink-0">
                    {l.tag}
                  </span>
                  <span className="text-[#bec6e0]">{l.content}</span>
                </div>
              )
            }

            if (l.type === 'info') {
              return (
                <div key={l.id} className="flex gap-3">
                  <span className="text-[#565e74] shrink-0">{l.timestamp}</span>
                  <span className="text-[#4cd7f6] font-bold shrink-0">
                    {l.tag}
                  </span>
                  <span className="text-[#bec6e0]">{l.content}</span>
                </div>
              )
            }

            if (l.type === 'command') {
              return (
                <div key={l.id} className="flex gap-3">
                  <span className="text-[#565e74] shrink-0">{l.timestamp}</span>
                  <span className="text-[#57dffe] font-semibold shrink-0">
                    admin@oda-core:~$
                  </span>
                  <span className="text-white font-semibold">{l.content}</span>
                </div>
              )
            }

            // Output block
            if (l.isPreformatted) {
              return (
                <div key={l.id} className="pl-0 sm:pl-24 text-[#4edea3]">
                  <pre className="whitespace-pre-wrap">{l.content}</pre>
                </div>
              )
            }

            return (
              <div key={l.id} className="pl-0 sm:pl-24 text-[#bec6e0]">
                {l.content}
              </div>
            )
          })}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Input */}
        <form
          onSubmit={handleExecute}
          className="flex items-center px-4 py-3 bg-[#0f172a] border-t border-[#565e74]/40"
        >
          <span className="text-[#57dffe] font-mono text-xs mr-3 font-semibold shrink-0">
            admin@oda-core:~$
          </span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Type command here... (try: help, scrape_trigger, sys_reboot, status_check)"
            className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-white placeholder-[#565e74] focus:ring-0"
            autoFocus
          />
        </form>
      </div>

      {/* Right Sidebar (Command Reference & System Status) */}
      <aside className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6">
        {/* Command Reference Card */}
        <div className="bg-white rounded-lg border border-[#e0f2fe] p-6 shadow-2xs">
          <h3 className="font-semibold text-lg text-[#1e293b] mb-4 border-b border-[#e0f2fe] pb-2">
            Command Reference
          </h3>
          <div className="space-y-4">
            <div>
              <button
                type="button"
                onClick={() =>
                  handleCommandRefClick('scrape_trigger --id 8829A-X9 --force')
                }
                className="font-mono text-xs text-[#006172] bg-[#e6eff5] hover:bg-[#57dffe]/20 px-2 py-1 rounded transition-colors font-semibold text-left cursor-pointer"
              >
                scrape_trigger
              </button>
              <p className="text-xs text-[#45464d] mt-1.5">
                Initiates a targeted scraping routine.
              </p>
              <p className="font-mono text-[11px] text-[#565e74] mt-1">
                Args:{' '}
                <code className="text-[#141d21]">--id &lt;task_id&gt;</code>,{' '}
                <code className="text-[#141d21]">--force</code>
              </p>
            </div>

            <div className="pt-3 border-t border-[#e0e9ef]">
              <button
                type="button"
                onClick={() =>
                  handleCommandRefClick('sys_reboot --node NODE_1')
                }
                className="font-mono text-xs text-[#006172] bg-[#e6eff5] hover:bg-[#57dffe]/20 px-2 py-1 rounded transition-colors font-semibold text-left cursor-pointer"
              >
                sys_reboot
              </button>
              <p className="text-xs text-[#45464d] mt-1.5">
                Gracefully restarts specific service nodes.
              </p>
              <p className="font-mono text-[11px] text-[#565e74] mt-1">
                Args:{' '}
                <code className="text-[#141d21]">--node &lt;name&gt;</code>
              </p>
            </div>

            <div className="pt-3 border-t border-[#e0e9ef]">
              <button
                type="button"
                onClick={() => handleCommandRefClick('log_tail --service api')}
                className="font-mono text-xs text-[#006172] bg-[#e6eff5] hover:bg-[#57dffe]/20 px-2 py-1 rounded transition-colors font-semibold text-left cursor-pointer"
              >
                log_tail
              </button>
              <p className="text-xs text-[#45464d] mt-1.5">
                Streams real-time logs from selected services.
              </p>
              <p className="font-mono text-[11px] text-[#565e74] mt-1">
                Args:{' '}
                <code className="text-[#141d21]">
                  --service &lt;api|db|worker&gt;
                </code>
              </p>
            </div>
          </div>
        </div>

        {/* System Status Card */}
        <div className="bg-white rounded-lg border border-[#e0f2fe] p-6 shadow-2xs">
          <h3 className="font-semibold text-lg text-[#1e293b] mb-4 border-b border-[#e0f2fe] pb-2">
            System Status
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#45464d] font-medium">API Gateway</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#009668] bg-[#4edea3]/20 px-2.5 py-1 rounded text-[11px]">
                <div className="w-2 h-2 rounded-full bg-[#009668]" />
                ONLINE
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#45464d] font-medium">Worker Nodes</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#009668] bg-[#4edea3]/20 px-2.5 py-1 rounded text-[11px]">
                <div className="w-2 h-2 rounded-full bg-[#009668]" />
                8/8 ACTIVE
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
