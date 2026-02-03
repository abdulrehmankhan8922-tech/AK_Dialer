'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import type { Campaign } from '@/lib/api'

interface CampaignAddEditModalProps {
  campaign?: Campaign | null
  onClose: () => void
  onSuccess: () => void
}

export default function CampaignAddEditModal({ campaign, onClose, onSuccess }: CampaignAddEditModalProps) {
  const isEditMode = !!campaign
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    status: 'active',
    dial_method: 'manual'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name || '',
        code: campaign.code || '',
        description: campaign.description || '',
        status: campaign.status || 'active',
        dial_method: campaign.dial_method || 'manual'
      })
    }
  }, [campaign])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!formData.name.trim()) {
      setError('Campaign name is required')
      return
    }

    if (!formData.code.trim()) {
      setError('Campaign code is required')
      return
    }

    // Validate code format (alphanumeric, uppercase)
    const codeRegex = /^[A-Z0-9]+$/
    if (!codeRegex.test(formData.code)) {
      setError('Campaign code must be uppercase alphanumeric only (e.g., J7GC4)')
      return
    }

    setLoading(true)

    try {
      if (isEditMode && campaign) {
        await adminAPI.updateCampaign(campaign.id, formData)
      } else {
        await adminAPI.createCampaign(formData)
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to save campaign')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {isEditMode ? 'Edit Campaign' : 'Create Campaign'}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Campaign Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., J7G Campaign 4"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Campaign Code * (Uppercase, Alphanumeric)
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., J7GC4"
                required
                disabled={isEditMode}
              />
              {isEditMode && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Code cannot be changed after creation</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Campaign description..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="paused">Paused</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Dial Method
              </label>
              <select
                value={formData.dial_method}
                onChange={(e) => setFormData({ ...formData, dial_method: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">Manual</option>
                <option value="progressive">Progressive</option>
                <option value="predictive">Predictive</option>
              </select>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
