/**
 * WebRTC Softphone Component
 * Integrates browser-based calling into the dialer interface
 */

'use client'

import { useEffect, useState } from 'react'
import { useWebRTCSoftphone } from '@/hooks/useWebRTCSoftphone'

interface WebRTCSoftphoneProps {
  agentExtension?: string
  agentPassword?: string
  onCallStateChange?: (isInCall: boolean, remoteNumber: string | null) => void
}

export default function WebRTCSoftphone({ 
  agentExtension, 
  agentPassword,
  onCallStateChange 
}: WebRTCSoftphoneProps) {
  const [server, setServer] = useState('wss://163.245.208.168:8089/ws')
  
  const {
    isConnected,
    isInCall,
    callState,
    connect,
    disconnect,
    error,
  } = useWebRTCSoftphone({
    enabled: true,
    server: server,
    username: agentExtension,
    password: agentPassword || 'password123',
  })

  // Auto-connect when component mounts
  useEffect(() => {
    if (agentExtension && !isConnected) {
      connect().catch((err) => {
        console.error('WebRTC connection failed:', err)
      })
    }

    return () => {
      if (isConnected) {
        disconnect().catch(console.error)
      }
    }
  }, [agentExtension, isConnected])

  // Notify parent of call state changes
  useEffect(() => {
    if (onCallStateChange) {
      onCallStateChange(isInCall, callState.remoteNumber)
    }
  }, [isInCall, callState.remoteNumber, onCallStateChange])

  // Show connection status (hidden by default, can be made visible for debugging)
  if (error) {
    console.error('WebRTC Error:', error)
  }

  return (
    <div className="hidden">
      {/* Hidden component - just manages WebRTC connection */}
      {isConnected && (
        <div className="text-xs text-green-600 dark:text-green-400">
          WebRTC Connected
        </div>
      )}
      {error && (
        <div className="text-xs text-red-600 dark:text-red-400">
          WebRTC Error: {error}
        </div>
      )}
    </div>
  )
}
