'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/shared/DashboardLayout'
import { agentsAPI } from '@/lib/api'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [agent, setAgent] = useState<any>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [notifications, setNotifications] = useState({
    email: true,
    sound: true,
    popup: false,
  })
  const [autoAnswer, setAutoAnswer] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    const loadAgent = async () => {
      try {
        const agentData = await agentsAPI.getMe()
        setAgent(agentData)
        const savedTheme = localStorage.getItem('theme') || 'dark'
        setTheme(savedTheme as 'light' | 'dark')
      } catch (error) {
        console.error('Error loading agent:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAgent()

    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [router])

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

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  const handleSave = async () => {
    // Save settings (implement backend endpoint for this)
    alert('Settings saved successfully!')
  }

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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>

        {/* Profile Settings */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
          <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Profile Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Username</label>
              <input
                type="text"
                value={agent?.username || ''}
                disabled
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
              <input
                type="text"
                value={agent?.full_name || ''}
                disabled
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Phone Extension</label>
              <input
                type="text"
                value={agent?.phone_extension || ''}
                disabled
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
          <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Preferences</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Theme</label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Choose light or dark mode</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`px-4 py-2 rounded-md font-medium ${
                    theme === 'light'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`px-4 py-2 rounded-md font-medium ${
                    theme === 'dark'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Auto-Answer Calls</label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Automatically answer incoming calls</p>
              </div>
              <button
                onClick={() => setAutoAnswer(!autoAnswer)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoAnswer ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoAnswer ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
          <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Notifications</h2>
          <div className="space-y-4">
            {Object.entries(notifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-700 last:border-0">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{key} Notifications</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {key === 'email' && 'Receive email notifications'}
                    {key === 'sound' && 'Play sound alerts'}
                    {key === 'popup' && 'Show popup notifications'}
                  </p>
                </div>
                <button
                  onClick={() => setNotifications({ ...notifications, [key]: !value })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    value ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      value ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold"
          >
            Save Settings
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}
