'use client'

import { useState, useEffect, useRef } from 'react'
import { callsAPI, agentsAPI } from '@/lib/api'
import { useWebRTCSoftphone } from '@/hooks/useWebRTCSoftphone'
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
  const [agentInfo, setAgentInfo] = useState<any>(null)
  const [useWebRTC, setUseWebRTC] = useState(true) // Enable WebRTC by default
  
  // Get agent info for WebRTC
  useEffect(() => {
    const loadAgentInfo = async () => {
      try {
        const agent = await agentsAPI.getMe()
        setAgentInfo(agent)
      } catch (error) {
        console.error('Error loading agent info:', error)
      }
    }
    loadAgentInfo()
  }, [])

  // WebRTC softphone hook
  const {
    isConnected: webrtcConnected,
    isInCall: webrtcInCall,
    dial: webrtcDial,
    hangup: webrtcHangup,
    connect: webrtcConnect,
    disconnect: webrtcDisconnect,
    error: webrtcError,
  } = useWebRTCSoftphone({
    enabled: useWebRTC && !!agentInfo,
    server: (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_WEBRTC_SERVER : null) || 'wss://101.50.86.185:8089/ws',
    username: agentInfo?.phone_extension,
    password: 'password123', // TODO: Get from secure storage
  })

  // Auto-connect WebRTC when agent info is loaded
  useEffect(() => {
    if (useWebRTC && agentInfo && !webrtcConnected) {
      webrtcConnect().catch((err) => {
        console.error('WebRTC auto-connect failed:', err)
      })
    }
    return () => {
      if (webrtcConnected) {
        webrtcDisconnect().catch(console.error)
      }
    }
  }, [useWebRTC, agentInfo, webrtcConnected])

  const handleManualDial = async () => {
    if (!manualDialNumber.trim()) {
      alert('Please enter a phone number')
      return
    }

    setLoading(true)
    try {
      if (useWebRTC && webrtcConnected) {
        // Use WebRTC to dial directly from browser
        await webrtcDial(manualDialNumber)
        // Also create call record in backend for tracking
        try {
          await callsAPI.dial(manualDialNumber)
        } catch (apiError) {
          console.warn('Backend call record creation failed, but WebRTC call proceeding:', apiError)
        }
      } else {
        // Fallback to backend dialing (AMI)
        await callsAPI.dial(manualDialNumber)
      }
      setManualDialNumber('')
      onCallUpdate()
    } catch (error: any) {
      alert(error.response?.data?.detail || error.message || 'Error making call')
    } finally {
      setLoading(false)
    }
  }

  const handleHangup = async () => {
    if (!currentCall) return

    setLoading(true)
    try {
      // Hangup WebRTC call if active
      if (useWebRTC && webrtcInCall) {
        try {
          await webrtcHangup()
        } catch (webrtcError) {
          console.warn('WebRTC hangup error:', webrtcError)
        }
      }
      
      // Hangup via backend API
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

  const handleDialNext = async () => {
    if (currentCall) {
      alert('Please hangup current call before dialing next')
      return
    }

    setLoading(true)
    try {
      // Get next contact and dial via WebRTC if enabled
      if (useWebRTC && webrtcConnected) {
        // Get next contact phone number
        const callResponse = await callsAPI.dialNext()
        if (callResponse && callResponse.phone_number) {
          await webrtcDial(callResponse.phone_number)
        }
      } else {
        await callsAPI.dialNext()
      }
      onCallUpdate()
      onStatsUpdate()
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'No more contacts available'
      alert(errorMsg)
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
      {/* WebRTC Status */}
      {useWebRTC && (
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${webrtcConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              WebRTC: {webrtcConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {webrtcError && (
            <span className="text-xs text-red-600 dark:text-red-400">{webrtcError}</span>
          )}
        </div>
      )}

      {/* Manual Dial */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Manual Dial
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useWebRTC}
              onChange={(e) => setUseWebRTC(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-xs text-slate-600 dark:text-slate-400">Use WebRTC</span>
          </label>
        </div>
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
      </div>
      </div>
    </>
  )
}
