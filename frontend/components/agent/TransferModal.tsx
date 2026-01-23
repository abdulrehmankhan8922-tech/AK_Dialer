'use client'

import { useState } from 'react'
import { callsAPI } from '@/lib/api'
import type { Call } from '@/lib/api'

interface TransferModalProps {
  call: Call
  onTransfer: () => void
  onClose: () => void
}

export default function TransferModal({ call, onTransfer, onClose }: TransferModalProps) {
  const [extension, setExtension] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!extension.trim()) {
      setError('Please enter a target extension')
      return
    }

    setLoading(true)
    setError('')

    try {
      await callsAPI.transfer(call.id, extension.trim())
      onTransfer()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to transfer call')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Transfer Call</h2>
        
        <form onSubmit={handleTransfer}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Target Extension
            </label>
            <input
              type="text"
              value={extension}
              onChange={(e) => setExtension(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter extension number"
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold disabled:opacity-50"
            >
              {loading ? 'Transferring...' : 'Transfer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md font-semibold hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
