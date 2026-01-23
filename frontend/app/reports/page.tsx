'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/shared/DashboardLayout'
import { statsAPI, campaignsAPI, adminAPI } from '@/lib/api'
import type { Stats, Campaign, AgentStats } from '@/lib/api'

export default function ReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [agentsStats, setAgentsStats] = useState<AgentStats[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all')
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [agentSearchQuery, setAgentSearchQuery] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    const agentData = JSON.parse(localStorage.getItem('agent_data') || '{}')
    const admin = agentData.is_admin === true || agentData.is_admin === 1
    setIsAdmin(admin)

    const loadData = async () => {
      try {
        if (admin) {
          // Load all agents stats for admin
          const allStats = await adminAPI.getAllAgentsStats()
          setAgentsStats(allStats)
        } else {
          // Load own stats for agent
          const campaignsData = await campaignsAPI.list()
          setCampaigns(campaignsData)
          await loadStats()
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [router, dateRange])

  const loadStats = async () => {
    try {
      const data = await statsAPI.getToday()
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  // Filtered agents stats for search
  const filteredAgentsStats = useMemo(() => {
    if (!agentSearchQuery) {
      return agentsStats
    }
    const query = agentSearchQuery.toLowerCase()
    return agentsStats.filter(stat =>
      stat.username.toLowerCase().includes(query) ||
      (stat.full_name && stat.full_name.toLowerCase().includes(query))
    )
  }, [agentsStats, agentSearchQuery])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-xl text-slate-700 dark:text-slate-300">Loading...</div>
      </div>
    )
  }

  const agentData = JSON.parse(localStorage.getItem('agent_data') || '{}')

  return (
    <DashboardLayout
      timeString={formatDateTime(currentTime)}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Reports & Analytics</h1>
          
          <div className="flex items-center space-x-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'today' | 'week' | 'month')}
              className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            
            <button
              onClick={loadStats}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Inbound Calls</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{stats.inbound_calls}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Outbound Calls</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{stats.outbound_calls}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 11V3a1 1 0 112 0v8a1 1 0 01-2 0zm6 4V3a1 1 0 112 0v12a1 1 0 01-2 0zM5 7V3a1 1 0 112 0v4a1 1 0 01-2 0zm0 10v-4a1 1 0 112 0v4a1 1 0 11-2 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Calls</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{stats.total_calls}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Abandoned</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{stats.abandoned_calls}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isAdmin && (
          <>
            {/* Performance Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
            <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Time Metrics</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-700 dark:text-slate-300">Login Time</span>
                <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stats?.login_time || '00:00:00'}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-700 dark:text-slate-300">Break Time</span>
                <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stats?.break_time || '00:00:00'}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-slate-700 dark:text-slate-300">Talk Time</span>
                <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {stats ? (parseInt(stats.login_time.split(':').join('')) - parseInt(stats.break_time.split(':').join(''))) : '00:00:00'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
            <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Call Performance</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300">Answer Rate</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {stats && stats.total_calls > 0 
                      ? Math.round(((stats.total_calls - stats.abandoned_calls) / stats.total_calls) * 100) 
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ 
                      width: `${stats && stats.total_calls > 0 
                        ? ((stats.total_calls - stats.abandoned_calls) / stats.total_calls) * 100 
                        : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300">Outbound vs Inbound</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {stats && stats.total_calls > 0 
                      ? Math.round((stats.outbound_calls / stats.total_calls) * 100) 
                      : 0}% / {stats && stats.total_calls > 0 
                      ? Math.round((stats.inbound_calls / stats.total_calls) * 100) 
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 flex">
                  <div 
                    className="bg-green-600 h-2 rounded-l-full" 
                    style={{ 
                      width: `${stats && stats.total_calls > 0 
                        ? (stats.outbound_calls / stats.total_calls) * 100 
                        : 0}%` 
                    }}
                  ></div>
                  <div 
                    className="bg-blue-600 h-2 rounded-r-full" 
                    style={{ 
                      width: `${stats && stats.total_calls > 0 
                        ? (stats.inbound_calls / stats.total_calls) * 100 
                        : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
          </>
        )}

        {isAdmin && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">All Agents Performance ({filteredAgentsStats.length})</h2>
            </div>
            {/* Search Input */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search agents by username or name..."
                value={agentSearchQuery}
                onChange={(e) => setAgentSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Agent</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Inbound</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Outbound</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Total</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Abandoned</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Answer Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgentsStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No agents found
                      </td>
                    </tr>
                  ) : (
                    filteredAgentsStats.map((stat) => (
                      <tr key={stat.agent_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{stat.full_name || stat.username}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{stat.inbound_calls}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{stat.outbound_calls}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-semibold">{stat.total_calls}</td>
                        <td className="py-3 px-4 text-red-600 dark:text-red-400">{stat.abandoned_calls}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-900 dark:text-slate-100">{stat.answer_rate}%</span>
                            <div className="w-20 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${stat.answer_rate}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
