'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI, agentsAPI, callsAPI, statsAPI, campaignsAPI, contactsAPI } from '@/lib/api'
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
import type { Call, Stats, Campaign, Contact } from '@/lib/api'

type ContactTab = 'active' | 'dialed' | 'failed'

export default function DialerPage() {
  const router = useRouter()
  const [agent, setAgent] = useState<any>(null)
  const [currentCall, setCurrentCall] = useState<Call | null>(null)
  const [incomingCall, setIncomingCall] = useState<Call | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null)
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'dialer' | 'history'>('dialer')
  const [contactTab, setContactTab] = useState<ContactTab>('active')
  const [activeContacts, setActiveContacts] = useState<Contact[]>([])
  const [dialedContacts, setDialedContacts] = useState<Contact[]>([])
  const [failedContacts, setFailedContacts] = useState<Contact[]>([])
  const [autoDialEnabled, setAutoDialEnabled] = useState(false)
  const [campaignStats, setCampaignStats] = useState({ total: 0, active: 0, dialed: 0, failed: 0 })
  const autoDialTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function to check if a call is active
  const isCallActive = (call: Call | null): boolean => {
    if (!call) return false
    const endedStatuses = ['ended', 'failed', 'busy', 'no_answer', 'transferred', 'parked']
    if (endedStatuses.includes(call.status)) return false
    if (call.end_time) {
      const endTime = new Date(call.end_time).getTime()
      const now = Date.now()
      if (now - endTime > 1000) return false
    }
    return true
  }

  // Load campaign statistics
  const loadCampaignStats = async () => {
    if (!selectedCampaignId) return
    try {
      const [active, dialed, failed] = await Promise.all([
        contactsAPI.getActive(selectedCampaignId, 1000),
        contactsAPI.getDialed(selectedCampaignId, 1000),
        contactsAPI.getFailed(selectedCampaignId, 1000),
      ])
      setCampaignStats({
        total: active.length + dialed.length + failed.length,
        active: active.length,
        dialed: dialed.length,
        failed: failed.length,
      })
    } catch (error) {
      console.error('Error loading campaign stats:', error)
    }
  }

  // Load contacts based on selected tab
  const loadContacts = async () => {
    if (!selectedCampaignId) return
    try {
      switch (contactTab) {
        case 'active':
          const active = await contactsAPI.getActive(selectedCampaignId, 500)
          setActiveContacts(active)
          break
        case 'dialed':
          const dialed = await contactsAPI.getDialed(selectedCampaignId, 100)
          setDialedContacts(dialed)
          break
        case 'failed':
          const failed = await contactsAPI.getFailed(selectedCampaignId, 100)
          setFailedContacts(failed)
          break
      }
      loadCampaignStats()
    } catch (error) {
      console.error('Error loading contacts:', error)
    }
  }

  // Auto-dial next contact
  const handleAutoDialNext = async () => {
    if (!autoDialEnabled || !selectedCampaignId || currentCall) return

    // Clear any existing timeout
    if (autoDialTimeoutRef.current) {
      clearTimeout(autoDialTimeoutRef.current)
      autoDialTimeoutRef.current = null
    }

    // Wait 2-3 seconds before dialing next (Pakistan industry standard)
    autoDialTimeoutRef.current = setTimeout(async () => {
      try {
        const nextContact = await contactsAPI.getNext(selectedCampaignId)
        if (!nextContact) {
          setAutoDialEnabled(false)
          alert('No more contacts available in this campaign')
          return
        }

        await callsAPI.dial(nextContact.phone, selectedCampaignId, nextContact.id)
        loadCurrentCall()
        loadStats()
        loadContacts()
      } catch (error: any) {
        console.error('Auto-dial error:', error)
        if (error.response?.status === 404) {
          setAutoDialEnabled(false)
        }
      }
    }, 2500) // 2.5 second delay
  }

  useEffect(() => {
    const initializeDashboard = async () => {
      const token = localStorage.getItem('access_token')
      if (!token) {
        router.push('/login')
        return
      }

      const agentData = localStorage.getItem('agent_data')
      if (agentData) {
        try {
          const data = JSON.parse(agentData)
          setAgent(data)
          setSessionInfo({
            session_id: data.session_id,
            campaign_id: data.campaign_id,
          })
          if (data.campaign_id) {
            setSelectedCampaignId(data.campaign_id)
          }
        } catch (error) {
          console.error('Error parsing agent data:', error)
          router.push('/login')
          return
        }
      }

      try {
        await agentsAPI.getMe()
        
        const campaignsList = await campaignsAPI.list()
        setCampaigns(campaignsList)
        
        if (Array.isArray(campaignsList) && campaignsList.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(campaignsList[0].id)
        }

        await loadStats()

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

        const timeInterval = setInterval(() => {
          setCurrentTime(new Date())
        }, 1000)

        loadCurrentCall().catch(console.error)

        const callInterval = setInterval(() => {
          loadCurrentCall().catch(console.error)
        }, 2000)

        const statsInterval = setInterval(() => {
          loadStats().catch(console.error)
        }, 30000)

        return () => {
          clearInterval(timeInterval)
          clearInterval(callInterval)
          clearInterval(statsInterval)
          if (autoDialTimeoutRef.current) {
            clearTimeout(autoDialTimeoutRef.current)
          }
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

  // Load contacts when campaign or tab changes
  useEffect(() => {
    if (selectedCampaignId) {
      loadContacts()
    }
  }, [selectedCampaignId, contactTab])

  // Auto-dial when call ends
  useEffect(() => {
    if (!currentCall && autoDialEnabled && selectedCampaignId) {
      handleAutoDialNext()
    }
    return () => {
      if (autoDialTimeoutRef.current) {
        clearTimeout(autoDialTimeoutRef.current)
      }
    }
  }, [currentCall, autoDialEnabled, selectedCampaignId])

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
      if (!call || !isCallActive(call)) {
        setCurrentCall(null)
        return
      }
      setCurrentCall(call)
    } catch (error) {
      console.error('Error loading current call:', error)
      setCurrentCall(null)
    }
  }

  const handleCallUpdate = (data: any) => {
    const endedStatuses = ['ended', 'failed', 'busy', 'no_answer', 'transferred', 'parked']
    if (data.status && endedStatuses.includes(data.status)) {
      setCurrentCall(null)
      loadStats()
      loadContacts()
      
      // Auto-dial next if enabled
      if (autoDialEnabled && selectedCampaignId) {
        handleAutoDialNext()
      }
      return
    }
    
    if (data.call_id) {
      loadCurrentCall()
    } else {
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
    if (data.call_id && (data.direction === 'inbound' || data.data?.direction === 'inbound')) {
      try {
        const currentCall = await callsAPI.getCurrent()
        if (currentCall && currentCall.id === data.call_id && currentCall.direction === 'inbound') {
          setIncomingCall(currentCall)
          return
        }
        const calls = await callsAPI.getHistory('inbound')
        const call = calls.find(c => c.id === data.call_id)
        if (call && (call.status === 'ringing' || call.status === 'dialing')) {
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
    loadContacts()
  }

  const handleDialNext = async () => {
    if (!selectedCampaignId) {
      alert('Please select a campaign first')
      return
    }
    if (currentCall) {
      alert('Please hangup current call before dialing next')
      return
    }

    try {
      const nextContact = await contactsAPI.getNext(selectedCampaignId)
      if (!nextContact) {
        alert('No more contacts available in this campaign')
        return
      }

      await callsAPI.dial(nextContact.phone, selectedCampaignId, nextContact.id)
      loadCurrentCall()
      loadStats()
      loadContacts()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error making call')
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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'contacted':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'busy':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'not_answered':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'new':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-xl text-slate-700 dark:text-slate-300">Loading...</div>
      </div>
    )
  }

  return (
    <DashboardLayout timeString={formatDateTime(currentTime)}>
      {/* Campaign Selector & Stats Bar */}
      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 border border-blue-200 dark:border-slate-600 rounded-lg shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Select Campaign <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCampaignId || ''}
              onChange={(e) => {
                const campaignId = e.target.value ? parseInt(e.target.value) : null
                setSelectedCampaignId(campaignId)
                setAutoDialEnabled(false) // Disable auto-dial when campaign changes
              }}
              className="w-full md:w-auto min-w-[300px] px-4 py-2.5 border-2 border-blue-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
              disabled={!!currentCall}
            >
              <option value="">-- Select a Campaign --</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name} ({campaign.code})
                </option>
              ))}
            </select>
          </div>
          
          {selectedCampaignId && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Total:</span>{' '}
                <span className="text-blue-600 dark:text-blue-400 font-bold">{campaignStats.total}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Active:</span>{' '}
                <span className="text-green-600 dark:text-green-400 font-bold">{campaignStats.active}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Dialed:</span>{' '}
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{campaignStats.dialed}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Failed:</span>{' '}
                <span className="text-red-600 dark:text-red-400 font-bold">{campaignStats.failed}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent Info & Call Status Bar */}
      <div className="mb-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold">User:</span> {agent?.username || 'N/A'} |{' '}
              <span className="font-semibold">Phone:</span> SIP/{agent?.username || 'N/A'}
            </div>
            {currentCall && isCallActive(currentCall) && <CallTimer call={currentCall} />}
          </div>
          <div>
            {currentCall && isCallActive(currentCall) ? (
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
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoDialEnabled}
                      onChange={(e) => {
                        setAutoDialEnabled(e.target.checked)
                        if (!e.target.checked && autoDialTimeoutRef.current) {
                          clearTimeout(autoDialTimeoutRef.current)
                          autoDialTimeoutRef.current = null
                        }
                      }}
                      disabled={!selectedCampaignId || !!currentCall}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Auto-Dial
                    </span>
                  </label>
                  {currentCall && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium">
                      <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse mr-2"></span>
                      Active Call
                    </span>
                  )}
                </div>
              </div>
              <CallControls
                currentCall={currentCall}
                onCallUpdate={loadCurrentCall}
                onStatsUpdate={() => {
                  loadStats()
                  loadContacts()
                }}
                campaigns={campaigns}
                selectedCampaignId={selectedCampaignId}
                onCampaignSelect={setSelectedCampaignId}
                onDialNext={handleDialNext}
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

          {/* Customer Information */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-6 text-slate-900 dark:text-slate-100">
              Customer Information
            </h2>
            <CustomerInfoForm currentCall={currentCall} campaigns={campaigns} />
          </div>

          {/* Contacts Section with Tabs */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Contacts</h2>
              <button
                onClick={loadContacts}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Refresh contacts"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Contact Tabs */}
            <div className="mb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex space-x-2">
                {(['active', 'dialed', 'failed'] as ContactTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setContactTab(tab)}
                    className={`px-4 py-2 font-semibold text-sm transition-colors ${
                      contactTab === tab
                        ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)} Contacts
                  </button>
                ))}
              </div>
            </div>

            {/* Contacts Table */}
            {!selectedCampaignId ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                Please select a campaign to view contacts
              </div>
            ) : (
              <>
                {contactTab === 'active' && (
                  <>
                    {activeContacts.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                          <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Phone</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Attempts</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {activeContacts.map((contact) => (
                              <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                                  {contact.name || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                                  {contact.phone}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(contact.status)}`}>
                                    {contact.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                                  {contact.dial_attempts || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No active contacts available
                      </div>
                    )}
                  </>
                )}

                {contactTab === 'dialed' && (
                  <>
                    {dialedContacts.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                          <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Phone</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Last Dialed</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {dialedContacts.map((contact) => (
                              <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                                  {contact.name || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                                  {contact.phone}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                                  {contact.last_dialed_at ? new Date(contact.last_dialed_at).toLocaleString() : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No dialed contacts yet
                      </div>
                    )}
                  </>
                )}

                {contactTab === 'failed' && (
                  <>
                    {failedContacts.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                          <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Phone</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Last Dialed</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {failedContacts.map((contact) => (
                              <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                                  {contact.name || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                                  {contact.phone}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                                  {contact.last_dialed_at ? new Date(contact.last_dialed_at).toLocaleString() : 'N/A'}
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={async () => {
                                      try {
                                        await contactsAPI.reactivate(contact.id)
                                        loadContacts()
                                        alert('Contact reactivated successfully')
                                      } catch (error: any) {
                                        alert(error.response?.data?.detail || 'Error reactivating contact')
                                      }
                                    }}
                                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                  >
                                    Reactivate
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No failed contacts
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Disposition Codes */}
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

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          onAnswer={handleIncomingCallAnswer}
          onReject={handleIncomingCallReject}
        />
      )}

      {/* WebRTC Softphone */}
      {agent && (
        <WebRTCSoftphone
          agentExtension={agent.phone_extension}
          agentPassword="password123"
          onCallStateChange={(isInCall, remoteNumber) => {
            console.log('WebRTC Call State:', { isInCall, remoteNumber })
          }}
        />
      )}
    </DashboardLayout>
  )
}
