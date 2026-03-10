'use client'

import { useState, useEffect } from 'react'
import { callsAPI, contactsAPI } from '@/lib/api'
import TransferModal from './TransferModal'
import type { Call, Campaign } from '@/lib/api'

interface CallControlsProps {
  currentCall: Call | null
  onCallUpdate: () => void
  onStatsUpdate: () => void
  campaigns?: Campaign[]
  selectedCampaignId?: number | null
  onCampaignSelect?: (campaignId: number | null) => void
  onDialNext?: () => void
}

export default function CallControls({ 
  currentCall, 
  onCallUpdate, 
  onStatsUpdate,
  campaigns = [],
  selectedCampaignId,
  onCampaignSelect,
  onDialNext
}: CallControlsProps) {
  const [manualDialNumber, setManualDialNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [dialingStatus, setDialingStatus] = useState('')

  // Clear manual dial number when call ends (but keep it during call to show the dialed number)
  useEffect(() => {
    if (!currentCall) {
      // Clear the input when call ends
      setManualDialNumber('')
    }
  }, [currentCall])

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
    } catch (error: any) {
      console.error('Error hanging up:', error)
      // Even on error, try to refresh to clear stuck state
      // The backend now always marks call as ended, so this should work
      onCallUpdate()
      onStatsUpdate()
      // Force clear after error
      setTimeout(() => {
        onCallUpdate()
      }, 500)
      
      // Show success message even if there was an error
      // (backend marks call as ended regardless)
      if (error.response?.status !== 404) {
        alert('Call has been cleared. If it was stuck, it should now be hung up.')
      }
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

  const handleDialNext = async () => {
    if (currentCall) {
      alert('Please hangup current call before dialing next')
      return
    }

    if (!selectedCampaignId) {
      alert('Please select a campaign first')
      return
    }

    if (onDialNext) {
      onDialNext()
      return
    }

    setLoading(true)
    setDialingStatus('Getting next contact...')
    try {
      const nextContact = await contactsAPI.getNext(selectedCampaignId)
      if (!nextContact) {
        setDialingStatus('')
        alert('No more contacts available in this campaign')
        setLoading(false)
        return
      }

      // Show the number in the input field before dialing
      setManualDialNumber(nextContact.phone)
      setDialingStatus(`Dialing ${nextContact.phone}...`)
      await callsAPI.dial(nextContact.phone, selectedCampaignId, nextContact.id)
      setDialingStatus('')
      // The input will now show currentCall.phone_number automatically
      onCallUpdate()
      onStatsUpdate()
    } catch (error: any) {
      setDialingStatus('')
      setManualDialNumber('') // Clear on error
      alert(error.response?.data?.detail || 'Error making call')
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
      {/* Dialing Status */}
      {dialingStatus && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg text-center font-medium">
          <span className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse mr-2 inline-block"></span>
          {dialingStatus}
        </div>
      )}

      {/* Manual Dial */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Manual Dial
        </label>
        <div className="flex space-x-3">
          <input
            type="text"
            value={currentCall?.phone_number || manualDialNumber}
            onChange={(e) => {
              // Only allow editing when there's no active call
              if (!currentCall) {
                setManualDialNumber(e.target.value)
              }
            }}
            placeholder="Enter phone number"
            className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
            disabled={loading || !!currentCall}
            readOnly={!!currentCall}
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
          onClick={handleDialNext}
          disabled={loading || !!currentCall}
          className="px-4 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2 font-medium transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.69l1.5 4.48a1 1 0 01-.5 1.21l-2.26 1.13a11.04 11.04 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.48 1.5a1 1 0 01.69.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
          </svg>
          <span>Dial Next</span>
        </button>

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
        
        {currentCall && (
          <button
            onClick={async () => {
              if (!currentCall) return
              if (!confirm('Force clear this stuck call? This will mark it as ended without hanging up via Asterisk.')) return
              
              setLoading(true)
              try {
                await callsAPI.forceClear(currentCall.id)
                onCallUpdate()
                onStatsUpdate()
                setTimeout(() => {
                  onCallUpdate()
                }, 500)
              } catch (error: any) {
                alert(error.response?.data?.detail || 'Error force clearing call')
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading || !currentCall}
            className="col-span-2 px-4 py-3 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center space-x-2 font-medium transition-colors shadow-sm"
            title="Force clear stuck call (use if hangup doesn't work)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Force Clear Stuck Call</span>
          </button>
        )}
      </div>
      </div>
    </>
  )
}
