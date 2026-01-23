'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/shared/DashboardLayout'
import CallScript from '@/components/agent/CallScript'
import { campaignsAPI } from '@/lib/api'

export default function ScriptPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    const loadCampaigns = async () => {
      try {
        const data = await campaignsAPI.list()
        setCampaigns(data)
        if (data.length > 0) {
          setSelectedCampaign(data[0].code)
        }
      } catch (error) {
        console.error('Error loading campaigns:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCampaigns()

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Call Scripts</h1>
          
          {campaigns.length > 0 && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Campaign:</label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.code}>
                    {campaign.code} - {campaign.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
          <CallScript campaignCode={selectedCampaign} />
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
          <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Script Guidelines</h2>
          <div className="space-y-3 text-slate-700 dark:text-slate-300">
            <div className="flex items-start space-x-3">
              <span className="text-blue-600 dark:text-blue-400 font-bold">1.</span>
              <p>Always greet the customer professionally</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-blue-600 dark:text-blue-400 font-bold">2.</span>
              <p>Introduce yourself and your company clearly</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-blue-600 dark:text-blue-400 font-bold">3.</span>
              <p>Listen actively to customer responses</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-blue-600 dark:text-blue-400 font-bold">4.</span>
              <p>Be respectful and maintain a positive tone</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-blue-600 dark:text-blue-400 font-bold">5.</span>
              <p>Follow the script steps in order</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
