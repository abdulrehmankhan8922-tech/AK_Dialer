'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI, agentsAPI, callsAPI, statsAPI, campaignsAPI } from '@/lib/api'
import { wsManager } from '@/lib/websocket'
import CallControls from '@/components/agent/CallControls'
import CustomerInfoForm from '@/components/agent/CustomerInfoForm'
import StatsDashboard from '@/components/agent/StatsDashboard'
import CallTimer from '@/components/agent/CallTimer'
import DispositionCodes from '@/components/agent/DispositionCodes'
import CallHistory from '@/components/agent/CallHistory'
import IncomingCallModal from '@/components/agent/IncomingCallModal'
import WebRTCSoftphone from '@/components/agent/WebRTCSoftphone'
import DashboardLayout from '@/components/shared/DashboardLayout'
import type { Call, Stats, Campaign } from '@/lib/api'

export default function DialerPage() {
  const router = useRouter()
  const [agent, setAgent] = useState<any>(null)
  const [currentCall, setCurrentCall] = useState<Call | null>(null)
  const [incomingCall, setIncomingCall] = useState<Call | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'dialer' | 'history'>('dialer')

  useEffect(() => {
    const initializeDashboard = async () => {
      // Check authentication
      const token = localStorage.getItem('access_token')
      if (!token) {
        router.push('/login')
        return
      }

      // Load agent data
      const agentData = localStorage.getItem('agent_data')
      if (agentData) {
        try {
          const data = JSON.parse(agentData)
          setAgent(data)
          setSessionInfo({
            session_id: data.session_id,
            campaign_id: data.campaign_id,
          })
        } catch (error) {
          console.error('Error parsing agent data:', error)
          router.push('/login')
          return
        }
      }

      try {
        // Verify token is valid by getting agent info
        await agentsAPI.getMe()
        
        // Load campaigns
        campaignsAPI.list().then(setCampaigns).catch((err) => {
          console.error('Error loading campaigns:', err)
        })

        // Load stats
        await loadStats()

        // Connect WebSocket
        if (token) {
          try {
            wsManager.connect(token)
            wsManager.on('call_update', handleCallUpdate)
            wsManager.on('incoming_call', handleIncomingCall)
            wsManager.on('stats_update', handleStatsUpdate)
            wsManager.on('agent_status', handleAgentStatus)
          } catch (wsError) {
            console.error('WebSocket connection error:', wsError)
          }
        }

        // Update current time every second
        const timeInterval = setInterval(() => {
          setCurrentTime(new Date())
        }, 1000)

        // Load current call
        loadCurrentCall().catch(console.error)

        // Refresh stats periodically
        const statsInterval = setInterval(() => {
          loadStats().catch(console.error)
        }, 30000)

        return () => {
          clearInterval(timeInterval)
          clearInterval(statsInterval)
          wsManager.off('call_update', handleCallUpdate)
          wsManager.off('incoming_call', handleIncomingCall)
          wsManager.off('stats_update', handleStatsUpdate)
          wsManager.off('agent_status', handleAgentStatus)
        }
      } catch (error: any) {
        console.error('Authentication or initialization error:', error)
        if (error.response?.status === 401) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('agent_data')
          router.push('/login')
        } else {
          setLoading(false)
        }
      }
    }

    initializeDashboard()
  }, [router])

  const loadStats = async () => {
    try {
      const data = await statsAPI.getToday()
      setStats(data)
      setLoading(false)
    } catch (error: any) {
      console.error('Error loading stats:', error)
      if (error.response?.status === 401) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('agent_data')
        router.push('/login')
      } else {
        setLoading(false)
      }
    }
  }

  const loadCurrentCall = async () => {
    try {
      const call = await callsAPI.getCurrent()
      setCurrentCall(call)
    } catch (error) {
      console.error('Error loading current call:', error)
    }
  }

  const handleCallUpdate = (data: any) => {
    if (data.call_id) {
      loadCurrentCall()
    }
  }

  const handleStatsUpdate = (data: any) => {
    loadStats()
  }

  const handleAgentStatus = (data: any) => {
    console.log('Agent status update:', data)
  }

  const handleIncomingCall = async (data: any) => {
    if (data.call_id && data.direction === 'inbound') {
      try {
        // Fetch the full call details
        const calls = await callsAPI.getHistory('inbound')
        const call = calls.find(c => c.id === data.call_id)
        if (call && call.status === 'ringing') {
          setIncomingCall(call)
        }
      } catch (error) {
        console.error('Error loading incoming call:', error)
      }
    }
  }

  const handleIncomingCallAnswer = () => {
    setIncomingCall(null)
    loadCurrentCall()
    loadStats()
  }

  const handleIncomingCallReject = () => {
    setIncomingCall(null)
    loadStats()
  }

  const handleDispositionSet = () => {
    loadCurrentCall()
    loadStats()
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-xl text-slate-700 dark:text-slate-300">Loading...</div>
      </div>
    )
  }

  return (
    <DashboardLayout
      timeString={formatDateTime(currentTime)}
    >
      {/* Agent Info & Call Status Bar */}
      <div className="mb-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold">User:</span> {agent?.username || 'N/A'} |{' '}
              <span className="font-semibold">Phone:</span> SIP/{agent?.username || 'N/A'} |{' '}
              {agent?.campaign_code && (
                <>
                  <span className="font-semibold">Campaign:</span> {agent.campaign_code}
                </>
              )}
            </div>
            {currentCall && <CallTimer call={currentCall} />}
          </div>
          <div>
            {currentCall ? (
              <span className="inline-flex items-center px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold shadow-lg">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse mr-2"></span>
                LIVE CALL - {currentCall.phone_number}
              </span>
            ) : (
              <span className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-sm font-semibold">
                NO LIVE CALL
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="mb-4">
        <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-700">
          {(['dialer', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-semibold text-sm transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'dialer' && (
        <div className="space-y-6">
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Left Column - Call Controls */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Call Controls</h2>
                {currentCall && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium">
                    <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse mr-2"></span>
                    Active Call
                  </span>
                )}
              </div>
              <CallControls
                currentCall={currentCall}
                onCallUpdate={loadCurrentCall}
                onStatsUpdate={loadStats}
              />
            </div>

            {/* Right Column - Statistics */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Today's Statistics</h2>
                <button
                  onClick={loadStats}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Refresh stats"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <StatsDashboard stats={stats} onRefresh={loadStats} />
            </div>
          </div>

          {/* Customer Information - Full Width */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-6 text-slate-900 dark:text-slate-100">
              Customer Information
            </h2>
            <CustomerInfoForm currentCall={currentCall} campaigns={campaigns} />
          </div>

          {/* Disposition Codes - Only show when call is active */}
          {currentCall && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-6 text-slate-900 dark:text-slate-100">
                Disposition Codes
              </h2>
              <DispositionCodes call={currentCall} onDispositionSet={handleDispositionSet} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
          <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Call History</h2>
          <CallHistory />
        </div>
      )}

      {/* WebRTC Softphone - Hidden component that manages browser-based calling */}
      {agent && (
        <WebRTCSoftphone
          agentExtension={agent.phone_extension}
          agentPassword="password123"
          onCallStateChange={(isInCall, remoteNumber) => {
            // Handle call state changes if needed
            console.log('WebRTC Call State:', { isInCall, remoteNumber })
          }}
        />
      )}

    </DashboardLayout>
  )
}
