'use client'

import { useState } from 'react'
import { callsAPI } from '@/lib/api'
import TransferModal from './TransferModal'
import type { Call } from '@/lib/api'

interface CallControlsProps {
  currentCall: Call | null
  onCallUpdate: () => void
  onStatsUpdate: () => void
}

export default function CallControls({ currentCall, onCallUpdate, onStatsUpdate }: CallControlsProps) {
  const [manualDialNumber, setManualDialNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)

  const handleManualDial = async () => {
    if (!manualDialNumber.trim()) {
      alert('Please enter a phone number')
      return
    }

    setLoading(true)
    try {
      await callsAPI.dial(manualDialNumber)
      setManualDialNumber('')
      onCallUpdate()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error making call')
    } finally {
      setLoading(false)
    }
  }

  const handleHangup = async () => {
    if (!currentCall) return

    setLoading(true)
    try {
      await callsAPI.hangup(currentCall.id)
      // Immediately trigger update - the backend should mark call as ended
      // This will cause loadCurrentCall to return null and clear the UI
      onCallUpdate()
      onStatsUpdate()
      
      // Force clear after a short delay as backup
      setTimeout(() => {
        onCallUpdate()
      }, 500)
    } catch (error) {
      console.error('Error hanging up:', error)
      // Even on error, try to refresh to clear stuck state
      onCallUpdate()
      // Force clear after error
      setTimeout(() => {
        onCallUpdate()
      }, 500)
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async () => {
    if (!currentCall) return
    setShowTransferModal(true)
  }

  const handleTransferComplete = () => {
    setShowTransferModal(false)
    onCallUpdate()
  }

  const handlePark = async () => {
    if (!currentCall) return

    setLoading(true)
    try {
      await callsAPI.park(currentCall.id)
      onCallUpdate()
    } catch (error) {
      console.error('Error parking call:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMute = async () => {
    if (!currentCall) return

    setLoading(true)
    try {
      if (currentCall.is_muted) {
        await callsAPI.unmute(currentCall.id)
      } else {
        await callsAPI.mute(currentCall.id)
      }
      onCallUpdate()
    } catch (error) {
      console.error('Error toggling mute:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleHold = async () => {
    if (!currentCall) return

    setLoading(true)
    try {
      if (currentCall.is_on_hold) {
        await callsAPI.unhold(currentCall.id)
      } else {
        await callsAPI.hold(currentCall.id)
      }
      onCallUpdate()
    } catch (error) {
      console.error('Error toggling hold:', error)
    } finally {
      setLoading(false)
    }
  }


  return (
    <>
      {showTransferModal && currentCall && (
        <TransferModal
          call={currentCall}
          onTransfer={handleTransferComplete}
          onClose={() => setShowTransferModal(false)}
        />
      )}
      
      <div className="space-y-5">
      {/* Manual Dial */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Manual Dial
        </label>
        <div className="flex space-x-3">
          <input
            type="text"
            value={manualDialNumber}
            onChange={(e) => setManualDialNumber(e.target.value)}
            placeholder="Enter phone number"
            className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            disabled={loading || !!currentCall}
          />
          <button
            onClick={handleManualDial}
            disabled={loading || !!currentCall}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
          >
            Dial
          </button>
        </div>
      </div>

      {/* Call Control Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleMute}
          disabled={loading || !currentCall}
          className={`px-4 py-3 rounded-lg flex items-center justify-center space-x-2 font-medium transition-colors ${
            currentCall?.is_muted
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
          } disabled:opacity-50`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {currentCall?.is_muted ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            )}
          </svg>
          <span>{currentCall?.is_muted ? 'Unmute' : 'Mute'}</span>
        </button>

        <button
          onClick={handleHold}
          disabled={loading || !currentCall}
          className={`px-4 py-3 rounded-lg flex items-center justify-center space-x-2 font-medium transition-colors ${
            currentCall?.is_on_hold
              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
          } disabled:opacity-50`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span>{currentCall?.is_on_hold ? 'Resume' : 'Hold'}</span>
        </button>

        <button
          onClick={handlePark}
          disabled={loading || !currentCall}
          className="px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 flex items-center justify-center space-x-2 font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span>Park</span>
        </button>

        <button
          onClick={handleTransfer}
          disabled={loading || !currentCall}
          className="px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 flex items-center justify-center space-x-2 font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span>Transfer</span>
        </button>

        <button
          onClick={handleHangup}
          disabled={loading || !currentCall}
          className="col-span-2 px-4 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 flex items-center justify-center space-x-2 font-medium transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M6 12a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
          <span>Hangup Call</span>
        </button>
      </div>
      </div>
    </>
  )
}
