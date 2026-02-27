'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/shared/DashboardLayout'
import ContactAddModal from '@/components/shared/ContactAddModal'
import { contactsAPI, campaignsAPI } from '@/lib/api'
import type { Contact, Campaign } from '@/lib/api'

export default function ContactsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    const loadData = async () => {
      try {
        const campaignsData = await campaignsAPI.list()
        setCampaigns(campaignsData)
      } catch (error) {
        console.error('Error loading campaigns:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [router])

  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const agentData = JSON.parse(localStorage.getItem('agent_data') || '{}')
    setIsAdmin(agentData.is_admin === true || agentData.is_admin === 1)
  }, [])

  const loadContacts = async () => {
    try {
      const campaignId = selectedCampaign === 'all' ? undefined : parseInt(selectedCampaign)
      const data = await contactsAPI.list(campaignId)
      setContacts(data)
    } catch (error) {
      console.error('Error loading contacts:', error)
      setContacts([])
    }
  }

  useEffect(() => {
    if (!loading) {
      loadContacts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaign, loading])

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

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = !searchTerm || 
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone?.includes(searchTerm)
    const matchesCampaign = selectedCampaign === 'all' || 
      contact.campaign_id?.toString() === selectedCampaign
    return matchesSearch && matchesCampaign
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-xl text-slate-700 dark:text-slate-300">Loading...</div>
      </div>
    )
  }

  const agentData = JSON.parse(localStorage.getItem('agent_data') || '{}')

  const handleContactCreated = () => {
    loadContacts()
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Please select an Excel file (.xlsx or .xls)')
      return
    }

    if (selectedCampaign === 'all') {
      alert('Please select a campaign first')
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const campaignId = parseInt(selectedCampaign)
      const result = await contactsAPI.import(file, campaignId)
      setImportResult({
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors || []
      })
      
      if (result.imported > 0) {
        loadContacts()
      }
    } catch (error: any) {
      alert(`Import failed: ${error.response?.data?.detail || error.message}`)
    } finally {
      setImporting(false)
      // Reset file input
      event.target.value = ''
    }
  }

  return (
    <DashboardLayout
      timeString={formatDateTime(currentTime)}
    >
      {(showAddModal || editingContact) && (
        <ContactAddModal
          campaigns={campaigns}
          contact={editingContact}
          onClose={() => {
            setShowAddModal(false)
            setEditingContact(null)
          }}
          onSuccess={handleContactCreated}
        />
      )}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Contacts</h1>
          <div className="flex gap-2">
            <label className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold cursor-pointer">
              {importing ? 'Importing...' : '📥 Import Excel'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileImport}
                disabled={importing}
                className="hidden"
              />
            </label>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold"
            >
              + Add Contact
            </button>
          </div>
        </div>

        {/* Import Result */}
        {importResult && (
          <div className={`p-4 rounded-lg ${
            importResult.imported > 0 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
          }`}>
            <div className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Import Complete
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300">
              ✅ Imported: {importResult.imported} contacts<br/>
              ⚠️ Skipped: {importResult.skipped} contacts
              {importResult.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-red-600 dark:text-red-400">
                    View Errors ({importResult.errors.length})
                  </summary>
                  <ul className="mt-2 list-disc list-inside text-xs max-h-40 overflow-y-auto">
                    {importResult.errors.map((error, idx) => (
                      <li key={idx} className="text-red-600 dark:text-red-400">{error}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or phone..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Campaign
              </label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Campaigns</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.code} - {campaign.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Contacts List */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-card">
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Phone</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Campaign</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No contacts found
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map((contact) => (
                      <tr key={contact.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{contact.name || '-'}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{contact.phone}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{contact.email || '-'}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {campaigns.find(c => c.id === contact.campaign_id)?.code || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            contact.status === 'contacted' 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
                          }`}>
                            {contact.status || 'new'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button 
                            onClick={() => setEditingContact(contact)}
                            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
