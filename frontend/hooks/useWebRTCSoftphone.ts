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
    server = 'ws://101.50.86.185:8089/ws', // Default to your server (ws:// for non-SSL)
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

  // Initialize softphone when credentials are available
  useEffect(() => {
    if (!enabled) return
    
    // Determine username and password
    let finalUsername = username
    let finalPassword = password
    
    // If not provided, try to get from localStorage
    if (!finalUsername || !finalPassword) {
      const agentData = localStorage.getItem('agent_data')
      if (agentData) {
        try {
          const data = JSON.parse(agentData)
          if (data.phone_extension && !finalUsername) {
            finalUsername = data.phone_extension
          }
          if (!finalPassword) {
            finalPassword = 'password123' // Default password
          }
        } catch (e) {
          console.error('Error parsing agent data:', e)
        }
      }
    }
    
    // Create softphone instance if we have credentials
    if (finalUsername && finalPassword && !softphoneRef.current) {
      console.log('Initializing WebRTC softphone:', { username: finalUsername, server })
      const config: SoftphoneConfig = {
        server: server,
        username: finalUsername,
        password: finalPassword,
        displayName: displayName || finalUsername,
      }
      
      softphoneRef.current = new WebRTCSoftphone(config, (state) => {
        setCallState(state)
      })
    }
  }, [enabled, username, password, server, displayName])

  const connect = useCallback(async () => {
    // Ensure softphone is initialized
    if (!softphoneRef.current) {
      // Try to get credentials
      let finalUsername = username
      let finalPassword = password
      
      if (!finalUsername || !finalPassword) {
        const agentData = localStorage.getItem('agent_data')
        if (agentData) {
          try {
            const data = JSON.parse(agentData)
            if (data.phone_extension && !finalUsername) {
              finalUsername = data.phone_extension
            }
            if (!finalPassword) {
              finalPassword = 'password123'
            }
          } catch (e) {
            console.error('Error parsing agent data:', e)
          }
        }
      }
      
      if (!finalUsername || !finalPassword) {
        throw new Error('Username and password required for WebRTC')
      }
      
      console.log('Creating WebRTC softphone instance:', { username: finalUsername, server })
      const config: SoftphoneConfig = {
        server,
        username: finalUsername,
        password: finalPassword,
        displayName: displayName || finalUsername,
      }
      softphoneRef.current = new WebRTCSoftphone(config, (state) => {
        setCallState(state)
      })
    }

    try {
      setError(null)
      console.log('Attempting WebRTC connection...')
      await softphoneRef.current.connect()
    } catch (err: any) {
      const errorMsg = err.message || 'Connection failed'
      setError(errorMsg)
      console.error('WebRTC connection error:', errorMsg)
      throw err
    }
  }, [server, username, password, displayName])

  const disconnect = useCallback(async () => {
    if (softphoneRef.current) {
      try {
        setError(null)
        await softphoneRef.current.disconnect()
        softphoneRef.current = null
      } catch (err: any) {
        setError(err.message || 'Disconnect failed')
      }
    }
  }, [])

  // Auto-connect when enabled
  useEffect(() => {
    if (enabled && !callState.isRegistered) {
      // Try to connect - connect() will create softphone if needed
      console.log('Auto-connecting WebRTC...', { enabled, registered: callState.isRegistered, hasSoftphone: !!softphoneRef.current })
      connect().catch((err) => {
        console.error('Auto-connect failed:', err)
        setError(err.message || 'Failed to connect WebRTC softphone')
      })
    }

    return () => {
      if (softphoneRef.current && callState.isRegistered) {
        disconnect().catch(console.error)
      }
    }
  }, [enabled, callState.isRegistered, connect, disconnect])

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
