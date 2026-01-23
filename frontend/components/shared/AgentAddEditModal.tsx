'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import type { Agent } from '@/lib/api'

interface AgentAddEditModalProps {
  agent?: Agent | null
  onClose: () => void
  onSuccess: () => void
}

export default function AgentAddEditModal({ agent, onClose, onSuccess }: AgentAddEditModalProps) {
  const isEditMode = !!agent
  const [formData, setFormData] = useState({
    username: '',
    phone_extension: '',
    full_name: '',
    password: '',
    is_admin: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (agent) {
      setFormData({
        username: agent.username || '',
        phone_extension: agent.phone_extension || '',
        full_name: agent.full_name || '',
        password: '', // Don't pre-fill password
        is_admin: agent.is_admin ? 1 : 0
      })
    }
  }, [agent])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.username.trim()) {
      setError('Username is required')
      return
    }

    if (!formData.phone_extension.trim()) {
      setError('Phone extension is required')
      return
    }

    if (!isEditMode && !formData.password.trim()) {
      setError('Password is required for new agents')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (isEditMode && agent) {
        // Update existing agent
        const updateData: any = {
          username: formData.username,
          phone_extension: formData.phone_extension,
          full_name: formData.full_name || undefined,
          is_admin: formData.is_admin
        }
        // Only include password if it's provided
        if (formData.password.trim()) {
          updateData.password = formData.password
        }
        await adminAPI.updateAgent(agent.id, updateData)
      } else {
        // Create new agent
        await adminAPI.createAgent({
          username: formData.username,
          phone_extension: formData.phone_extension,
          full_name: formData.full_name || undefined,
          password: formData.password,
          is_admin: formData.is_admin
        })
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to ${isEditMode ? 'update' : 'create'} agent`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'is_admin' ? parseInt(value) : value
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl" 
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">
          {isEditMode ? 'Edit Agent' : 'Create New Agent'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Username - Required */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Phone Extension - Required */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Phone Extension <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="phone_extension"
              value={formData.phone_extension}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Full Name - Optional */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Password {!isEditMode && <span className="text-red-500">*</span>}
              {isEditMode && <span className="text-slate-500 text-xs">(leave blank to keep current)</span>}
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={!isEditMode}
            />
          </div>

          {/* Admin Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Role
            </label>
            <select
              name="is_admin"
              value={formData.is_admin}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>Agent</option>
              <option value={1}>Admin</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : (isEditMode ? 'Update Agent' : 'Create Agent')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
