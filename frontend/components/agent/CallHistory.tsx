'use client'

import { useState, useEffect } from 'react'
import { callsAPI } from '@/lib/api'
import type { Call } from '@/lib/api'

export default function CallHistory() {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'today' | 'outbound' | 'inbound'>('today')

  useEffect(() => {
    loadCalls()
  }, [filter])

  const loadCalls = async () => {
    setLoading(true)
    try {
      const data = await callsAPI.getHistory(filter)
      setCalls(data)
    } catch (error) {
      console.error('Error loading call history:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'answered':
      case 'connected':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
      case 'no_answer':
      case 'busy':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex space-x-2">
        {(['all', 'today', 'outbound', 'inbound'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Call List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">Loading...</div>
        ) : calls.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">No calls found</div>
        ) : (
          calls.map((call) => (
            <div
              key={call.id}
              className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {call.phone_number}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(call.status)}`}>
                    {call.status}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(call.start_time)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>{call.direction === 'outbound' ? 'Outbound' : 'Inbound'}</span>
                <div className="flex items-center space-x-3">
                  {call.ring_duration > 0 && (
                    <span className="text-yellow-600 dark:text-yellow-400">
                      Ring: {formatDuration(call.ring_duration)}
                    </span>
                  )}
                  {call.talk_duration > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      Talk: {formatDuration(call.talk_duration)}
                    </span>
                  )}
                  {call.duration > 0 && (
                    <span>Total: {formatDuration(call.duration)}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
