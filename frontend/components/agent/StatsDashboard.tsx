'use client'

import { useState } from 'react'
import { statsAPI } from '@/lib/api'
import type { Stats } from '@/lib/api'

interface StatsDashboardProps {
  stats: Stats | null
  onRefresh: () => void
}

export default function StatsDashboard({ stats, onRefresh }: StatsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound' | 'missed'>('inbound')
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setTimeout(() => setRefreshing(false), 1000)
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        No statistics available
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Today Stats - Clean Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/40 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Inbound</div>
          <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.inbound_calls}</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/40 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <div className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Outbound</div>
          <div className="text-3xl font-bold text-green-700 dark:text-green-300">{stats.outbound_calls}</div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/40 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Abandoned</div>
          <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">{stats.abandoned_calls}</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/40 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">Total</div>
          <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">{stats.total_calls}</div>
        </div>
      </div>

      {/* Time Stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Break Time</div>
          <div className="text-xl font-semibold text-slate-800 dark:text-slate-200">{stats.break_time}</div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Login Time</div>
          <div className="text-xl font-semibold text-slate-800 dark:text-slate-200">{stats.login_time}</div>
        </div>
      </div>
    </div>
  )
}
