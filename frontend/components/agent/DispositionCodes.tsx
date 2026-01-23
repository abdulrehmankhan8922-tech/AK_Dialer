'use client'

import { useState } from 'react'
import { callsAPI } from '@/lib/api'
import type { Call } from '@/lib/api'

interface DispositionCodesProps {
  call: Call | null
  onDispositionSet: () => void
}

const DISPOSITION_CODES = [
  { code: 'SALE', label: 'Sale Made', color: 'bg-green-500' },
  { code: 'CBH', label: 'Callback - Hot', color: 'bg-orange-500' },
  { code: 'CBW', label: 'Callback - Warm', color: 'bg-yellow-500' },
  { code: 'CBC', label: 'Callback - Cold', color: 'bg-blue-500' },
  { code: 'NI', label: 'Not Interested', color: 'bg-red-500' },
  { code: 'DNC', label: 'Do Not Call', color: 'bg-gray-500' },
  { code: 'VM', label: 'Voicemail', color: 'bg-purple-500' },
  { code: 'NA', label: 'No Answer', color: 'bg-slate-500' },
  { code: 'BUSY', label: 'Busy', color: 'bg-amber-500' },
  { code: 'FAX', label: 'Fax Machine', color: 'bg-cyan-500' },
]

export default function DispositionCodes({ call, onDispositionSet }: DispositionCodesProps) {
  const [selectedCode, setSelectedCode] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSetDisposition = async () => {
    if (!call || !selectedCode) return

    setSaving(true)
    try {
      // Update call with disposition and notes
      await callsAPI.updateDisposition(call.id, selectedCode, notes)
      onDispositionSet()
      setSelectedCode('')
      setNotes('')
    } catch (error) {
      console.error('Error setting disposition:', error)
      alert('Failed to set disposition')
    } finally {
      setSaving(false)
    }
  }

  if (!call) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        No active call for disposition
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Select Disposition Code
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DISPOSITION_CODES.map((disp) => (
            <button
              key={disp.code}
              onClick={() => setSelectedCode(disp.code)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                selectedCode === disp.code
                  ? `${disp.color} text-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-slate-400`
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {disp.code} - {disp.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Call Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Add notes about this call..."
        />
      </div>

      <button
        onClick={handleSetDisposition}
        disabled={!selectedCode || saving}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving...' : 'Set Disposition & End Call'}
      </button>
    </div>
  )
}
