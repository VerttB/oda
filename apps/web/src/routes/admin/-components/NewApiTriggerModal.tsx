import React, { useState } from 'react'
import { X, Sparkles, Plus, Clock, Shield } from 'lucide-react'

interface NewApiTriggerModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (route: {
    path: string
    method: string
    description: string
  }) => void
}

export const NewApiTriggerModal: React.FC<NewApiTriggerModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [path, setPath] = useState('/v1/')
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState<
    'manual' | 'scheduled' | 'webhook'
  >('manual')
  const [cronExpression, setCronExpression] = useState('0 */6 * * *')
  const [authLevel, setAuthLevel] = useState<'bearer' | 'admin' | 'public'>(
    'bearer',
  )

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!path.trim()) return

    onCreated({
      path: path.trim(),
      method,
      description: description.trim() || 'Custom registered API trigger',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-[#c6c6cd]/60 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#c6c6cd]/40 bg-[#ecf5fb]/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#06b6d4]/20 text-[#006172] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#141d21]">
                Register New API Trigger
              </h3>
              <p className="text-xs text-[#45464d]">
                Deploy a new endpoint route or scheduled scraper task
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#45464d] hover:text-[#141d21] p-1 rounded-md hover:bg-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Endpoint Path & Method */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#141d21] uppercase tracking-wider text-[11px]">
              Endpoint URL & Method
            </label>
            <div className="flex gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="bg-[#ecf5fb] border border-[#c6c6cd] rounded-lg px-3 py-2 font-semibold text-[#00687a] focus:outline-none focus:border-[#06b6d4]"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>

              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/v1/my-route"
                required
                className="flex-1 bg-[#ecf5fb] border border-[#c6c6cd] rounded-lg px-3 py-2 font-mono text-[#141d21] focus:outline-none focus:border-[#06b6d4]"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#141d21] uppercase tracking-wider text-[11px]">
              Route Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Fetch aggregated citation metrics by institution"
              className="w-full bg-[#ecf5fb] border border-[#c6c6cd] rounded-lg px-3 py-2 text-[#141d21] focus:outline-none focus:border-[#06b6d4]"
            />
          </div>

          {/* Trigger Type */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#141d21] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#00687a]" />
              <span>Trigger Dispatch Mode</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTriggerType('manual')}
                className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                  triggerType === 'manual'
                    ? 'border-[#06b6d4] bg-[#57dffe]/20 text-[#006172] font-bold'
                    : 'border-[#c6c6cd]/60 text-[#45464d] hover:bg-[#ecf5fb]'
                }`}
              >
                On Demand
              </button>
              <button
                type="button"
                onClick={() => setTriggerType('scheduled')}
                className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                  triggerType === 'scheduled'
                    ? 'border-[#06b6d4] bg-[#57dffe]/20 text-[#006172] font-bold'
                    : 'border-[#c6c6cd]/60 text-[#45464d] hover:bg-[#ecf5fb]'
                }`}
              >
                Cron Schedule
              </button>
              <button
                type="button"
                onClick={() => setTriggerType('webhook')}
                className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                  triggerType === 'webhook'
                    ? 'border-[#06b6d4] bg-[#57dffe]/20 text-[#006172] font-bold'
                    : 'border-[#c6c6cd]/60 text-[#45464d] hover:bg-[#ecf5fb]'
                }`}
              >
                Inbound Hook
              </button>
            </div>
          </div>

          {triggerType === 'scheduled' && (
            <div className="space-y-1.5">
              <label className="font-semibold text-[#141d21] uppercase tracking-wider text-[11px]">
                Cron Expression
              </label>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="w-full bg-[#ecf5fb] border border-[#c6c6cd] rounded-lg px-3 py-2 font-mono text-[#141d21] focus:outline-none focus:border-[#06b6d4]"
              />
            </div>
          )}

          {/* Auth Level */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#141d21] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#00687a]" />
              <span>Authentication Requirement</span>
            </label>
            <select
              value={authLevel}
              onChange={(e) => setAuthLevel(e.target.value as any)}
              className="w-full bg-[#ecf5fb] border border-[#c6c6cd] rounded-lg px-3 py-2 text-[#141d21] focus:outline-none focus:border-[#06b6d4]"
            >
              <option value="bearer">Bearer Token (Standard API Key)</option>
              <option value="admin">Administrator Secret Only</option>
              <option value="public">Public / Unrestricted</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#c6c6cd]/40 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#c6c6cd] rounded-lg text-[#45464d] hover:bg-[#ecf5fb] font-semibold uppercase tracking-wider text-[11px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#06b6d4] hover:bg-[#0891b2] text-white rounded-lg font-semibold uppercase tracking-wider text-[11px] shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Deploy Route</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
