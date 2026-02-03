/**
 * React hook for WebRTC Softphone
 * Manages WebRTC connection and call state
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { WebRTCSoftphone, CallState, SoftphoneConfig } from '@/lib/webrtc-softphone'

export interface UseWebRTCSoftphoneOptions {
  enabled?: boolean
  server?: string // WebRTC server (e.g., wss://163.245.208.168:8089/ws)
  username?: string // Agent extension
  password?: string // Agent password
  displayName?: string
}

export interface UseWebRTCSoftphoneReturn {
  isConnected: boolean
  isInCall: boolean
  callState: CallState
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  dial: (phoneNumber: string) => Promise<void>
  hangup: () => Promise<void>
  answer: () => Promise<void>
  reject: () => Promise<void>
  mute: (mute: boolean) => Promise<void>
  hold: (hold: boolean) => Promise<void>
  error: string | null
}

export function useWebRTCSoftphone(options: UseWebRTCSoftphoneOptions = {}): UseWebRTCSoftphoneReturn {
  const {
    enabled = true,
    server = 'wss://163.245.208.168:8089/ws', // Default to your server
    username,
    password,
    displayName,
  } = options

  const [callState, setCallState] = useState<CallState>({
    isRegistered: false,
    isInCall: false,
    currentSession: null,
    remoteAudio: null,
    callStatus: 'idle',
    remoteNumber: null,
  })
  const [error, setError] = useState<string | null>(null)
  const softphoneRef = useRef<WebRTCSoftphone | null>(null)

  // Get agent info from localStorage
  useEffect(() => {
    if (!enabled || !username || !password) {
      const agentData = localStorage.getItem('agent_data')
      if (agentData) {
        try {
          const data = JSON.parse(agentData)
          if (data.phone_extension && !username) {
            // Auto-configure from agent data
            const config: SoftphoneConfig = {
              server: server,
              username: data.phone_extension,
              password: password || 'password123', // Default password
              displayName: data.full_name || data.username,
            }
            
            if (!softphoneRef.current) {
              softphoneRef.current = new WebRTCSoftphone(config, (state) => {
                setCallState(state)
              })
            }
          }
        } catch (e) {
          console.error('Error parsing agent data:', e)
        }
      }
    }
  }, [enabled, username, password, server])

  // Auto-connect when enabled and credentials available
  useEffect(() => {
    if (enabled && softphoneRef.current && !callState.isRegistered) {
      connect().catch((err) => {
        console.error('Auto-connect failed:', err)
        setError(err.message || 'Failed to connect WebRTC softphone')
      })
    }

    return () => {
      if (softphoneRef.current) {
        disconnect().catch(console.error)
      }
    }
  }, [enabled])

  const connect = useCallback(async () => {
    if (!softphoneRef.current) {
      if (!username || !password) {
        throw new Error('Username and password required')
      }
      const config: SoftphoneConfig = {
        server,
        username,
        password,
        displayName,
      }
      softphoneRef.current = new WebRTCSoftphone(config, (state) => {
        setCallState(state)
      })
    }

    try {
      setError(null)
      await softphoneRef.current.connect()
    } catch (err: any) {
      setError(err.message || 'Connection failed')
      throw err
    }
  }, [server, username, password, displayName])

  const disconnect = useCallback(async () => {
    if (softphoneRef.current) {
      try {
        await softphoneRef.current.disconnect()
        softphoneRef.current = null
      } catch (err: any) {
        setError(err.message || 'Disconnect failed')
      }
    }
  }, [])

  const dial = useCallback(async (phoneNumber: string) => {
    if (!softphoneRef.current) {
      throw new Error('Softphone not connected')
    }
    try {
      setError(null)
      await softphoneRef.current.dial(phoneNumber)
    } catch (err: any) {
      setError(err.message || 'Dial failed')
      throw err
    }
  }, [])

  const hangup = useCallback(async () => {
    if (!softphoneRef.current) {
      return
    }
    try {
      setError(null)
      await softphoneRef.current.hangup()
    } catch (err: any) {
      setError(err.message || 'Hangup failed')
    }
  }, [])

  const answer = useCallback(async () => {
    if (!softphoneRef.current) {
      throw new Error('Softphone not connected')
    }
    try {
      setError(null)
      await softphoneRef.current.answer()
    } catch (err: any) {
      setError(err.message || 'Answer failed')
      throw err
    }
  }, [])

  const reject = useCallback(async () => {
    if (!softphoneRef.current) {
      throw new Error('Softphone not connected')
    }
    try {
      setError(null)
      await softphoneRef.current.reject()
    } catch (err: any) {
      setError(err.message || 'Reject failed')
      throw err
    }
  }, [])

  const mute = useCallback(async (mute: boolean) => {
    if (!softphoneRef.current) {
      return
    }
    try {
      await softphoneRef.current.mute(mute)
    } catch (err: any) {
      setError(err.message || 'Mute failed')
    }
  }, [])

  const hold = useCallback(async (hold: boolean) => {
    if (!softphoneRef.current) {
      return
    }
    try {
      await softphoneRef.current.hold(hold)
    } catch (err: any) {
      setError(err.message || 'Hold failed')
    }
  }, [])

  return {
    isConnected: callState.isRegistered,
    isInCall: callState.isInCall,
    callState,
    connect,
    disconnect,
    dial,
    hangup,
    answer,
    reject,
    mute,
    hold,
    error,
  }
}
