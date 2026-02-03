'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/shared/DashboardLayout'
import { asteriskAPI } from '@/lib/api'

type Tab = 'status' | 'endpoints' | 'dialplan' | 'trunk'

export default function AsteriskConfigPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('status')
  const [asteriskStatus, setAsteriskStatus] = useState<{ running: boolean; version?: string } | null>(null)
  const [endpoints, setEndpoints] = useState<any[]>([])
  const [dialplanContent, setDialplanContent] = useState('')
  const [trunkConfig, setTrunkConfig] = useState<{ exists: boolean; server?: string; username?: string; password?: string; port?: number } | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Form states
  const [newEndpoint, setNewEndpoint] = useState({ extension: '', password: '', context: 'from-internal', callerid: '' })
  const [trunkForm, setTrunkForm] = useState({ server: '', username: '', password: '', port: 5060 })

  useEffect(() => {
    const checkAdminAuth = async () => {
      const token = localStorage.getItem('access_token')
      const agentData = JSON.parse(localStorage.getItem('agent_data') || '{}')

      if (!token || !agentData.is_admin) {
        router.push('/login')
        return
      }
      setIsAdmin(true)
      loadData()
      setLoading(false)
    }

    checkAdminAuth()

    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [router])

  const loadData = async () => {
    try {
      const [status, endpointsData, dialplanData, trunkData] = await Promise.all([
        asteriskAPI.getStatus(),
        asteriskAPI.listEndpoints(),
        asteriskAPI.getDialplan(),
        asteriskAPI.getTrunk()
      ])
      setAsteriskStatus(status)
      setEndpoints(endpointsData)
      setDialplanContent(dialplanData.content || '')
      setTrunkConfig(trunkData)
      if (trunkData.exists) {
        setTrunkForm({
          server: trunkData.server || '',
          username: trunkData.username || '',
          password: trunkData.password || '',
          port: trunkData.port || 5060
        })
      }
    } catch (error) {
      console.error('Error loading Asterisk data:', error)
    }
  }

  const handleCreateEndpoint = async () => {
    try {
      await asteriskAPI.createEndpoint(newEndpoint)
      alert('Endpoint created successfully!')
      setNewEndpoint({ extension: '', password: '', context: 'from-internal', callerid: '' })
      loadData()
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleDeleteEndpoint = async (extension: string) => {
    if (!confirm(`Delete endpoint ${extension}?`)) return
    try {
      await asteriskAPI.deleteEndpoint(extension)
      alert('Endpoint deleted successfully!')
      loadData()
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleUpdateDialplan = async () => {
    try {
      await asteriskAPI.updateDialplan(dialplanContent)
      alert('Dialplan updated successfully!')
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleUpdateTrunk = async () => {
    try {
      await asteriskAPI.updateTrunk(trunkForm)
      alert('Trunk configuration updated successfully!')
      loadData()
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleReload = async (module?: string) => {
    try {
      await asteriskAPI.reload(module)
      alert(`${module || 'Asterisk'} reloaded successfully!`)
      loadData()
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`)
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-xl text-slate-700 dark:text-slate-300">Loading...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-xl text-red-600 dark:text-red-400">Access Denied: Admin access required</div>
      </div>
    )
  }

  return (
    <DashboardLayout timeString={formatDateTime(currentTime)} title="Asterisk Configuration">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {(['status', 'endpoints', 'dialplan', 'trunk'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
                } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 capitalize`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Status Tab */}
        {activeTab === 'status' && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Asterisk Status</h2>
              <button
                onClick={() => loadData()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
              >
                Refresh
              </button>
            </div>
            {asteriskStatus && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${asteriskStatus.running ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-slate-900 dark:text-slate-100">
                    Status: {asteriskStatus.running ? 'Running' : 'Stopped'}
                  </span>
                </div>
                {asteriskStatus.version && (
                  <div className="text-slate-700 dark:text-slate-300">
                    Version: {asteriskStatus.version}
                  </div>
                )}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleReload('pjsip')}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                  >
                    Reload PJSIP
                  </button>
                  <button
                    onClick={() => handleReload('dialplan')}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                  >
                    Reload Dialplan
                  </button>
                  <button
                    onClick={() => handleReload()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                  >
                    Reload All
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Endpoints Tab */}
        {activeTab === 'endpoints' && (
          <div className="space-y-6">
            {/* Create Endpoint Form */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Create New Endpoint</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Extension
                  </label>
                  <input
                    type="text"
                    value={newEndpoint.extension}
                    onChange={(e) => setNewEndpoint({ ...newEndpoint, extension: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md"
                    placeholder="8015"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Password
                  </label>
                  <input
                    type="text"
                    value={newEndpoint.password}
                    onChange={(e) => setNewEndpoint({ ...newEndpoint, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md"
                    placeholder="password123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Context
                  </label>
                  <input
                    type="text"
                    value={newEndpoint.context}
                    onChange={(e) => setNewEndpoint({ ...newEndpoint, context: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md"
                    placeholder="from-internal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Caller ID
                  </label>
                  <input
                    type="text"
                    value={newEndpoint.callerid}
                    onChange={(e) => setNewEndpoint({ ...newEndpoint, callerid: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md"
                    placeholder="Agent 8015 <8015>"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateEndpoint}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                Create Endpoint
              </button>
            </div>

            {/* Endpoints List */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">PJSIP Endpoints</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Extension</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Context</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoints.map((endpoint) => (
                      <tr key={endpoint.extension} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{endpoint.extension}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{endpoint.context}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            endpoint.registered
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
                          }`}>
                            {endpoint.registered ? 'Registered' : 'Not Registered'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleDeleteEndpoint(endpoint.extension)}
                            className="text-red-600 dark:text-red-400 hover:underline text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Dialplan Tab */}
        {activeTab === 'dialplan' && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Dialplan Configuration</h2>
              <button
                onClick={() => loadData()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
              >
                Reload
              </button>
            </div>
            <textarea
              value={dialplanContent}
              onChange={(e) => setDialplanContent(e.target.value)}
              className="w-full h-96 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md font-mono text-sm"
            />
            <button
              onClick={handleUpdateDialplan}
              className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
            >
              Save & Reload Dialplan
            </button>
          </div>
        )}

        {/* Trunk Tab */}
        {activeTab === 'trunk' && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">SIP Trunk Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Server
                </label>
                <input
                  type="text"
                  value={trunkForm.server}
                  onChange={(e) => setTrunkForm({ ...trunkForm, server: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md"
                  placeholder="sip.provider.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Port
                </label>
                <input
                  type="number"
                  value={trunkForm.port}
                  onChange={(e) => setTrunkForm({ ...trunkForm, port: parseInt(e.target.value) || 5060 })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={trunkForm.username}
                  onChange={(e) => setTrunkForm({ ...trunkForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={trunkForm.password}
                  onChange={(e) => setTrunkForm({ ...trunkForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md"
                />
              </div>
            </div>
            <button
              onClick={handleUpdateTrunk}
              className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
            >
              Save & Reload Trunk
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
