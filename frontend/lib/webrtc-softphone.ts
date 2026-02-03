/**
 * WebRTC Softphone using SIP.js
 * Allows agents to make and receive calls directly from the browser
 * 
 * Note: This requires Asterisk to be configured with WebRTC support
 * See: WEBRTC_SETUP.md for Asterisk configuration
 */

import { 
  UserAgent, 
  Registerer, 
  Inviter, 
  Invitation, 
  SessionState, 
  Session,
  RegistererState as RegistererStateEnum
} from 'sip.js'
import { Web } from 'sip.js/lib/platform/web'

export interface SoftphoneConfig {
  server: string // Asterisk WebRTC server (e.g., wss://163.245.208.168:8089/ws)
  username: string // Agent extension (e.g., 8013)
  password: string // Agent password
  displayName?: string
}

export interface CallState {
  isRegistered: boolean
  isInCall: boolean
  currentSession: Session | null
  remoteAudio: HTMLAudioElement | null
  callStatus: 'idle' | 'ringing' | 'connected' | 'ended'
  remoteNumber: string | null
}

export class WebRTCSoftphone {
  private userAgent: UserAgent | null = null
  private registerer: Registerer | null = null
  private config: SoftphoneConfig
  private callState: CallState
  private onStateChange: (state: CallState) => void
  private remoteAudioElement: HTMLAudioElement | null = null

  constructor(config: SoftphoneConfig, onStateChange: (state: CallState) => void) {
    this.config = config
    this.onStateChange = onStateChange
    this.callState = {
      isRegistered: false,
      isInCall: false,
      currentSession: null,
      remoteAudio: null,
      callStatus: 'idle',
      remoteNumber: null,
    }
  }

  /**
   * Initialize and register the softphone
   */
  async connect(): Promise<void> {
    try {
      // Extract domain from server URL
      const domain = this.config.server.replace(/^wss?:\/\//, '').split('/')[0].split(':')[0]
      
      // Create WebRTC user agent
      const userAgentOptions: any = {
        uri: UserAgent.makeURI(`sip:${this.config.username}@${domain}`),
        transportOptions: {
          server: this.config.server,
        },
        authorizationUsername: this.config.username,
        authorizationPassword: this.config.password,
        displayName: this.config.displayName || this.config.username,
        delegate: {
          onInvite: (invitation: Invitation) => this.handleIncomingCall(invitation),
        },
        sessionDescriptionHandlerFactory: Web.sessionDescriptionHandlerFactory,
      }

      this.userAgent = new UserAgent(userAgentOptions)

      // Create registerer
      this.registerer = new Registerer(this.userAgent)

      // Handle registration state changes
      this.registerer.stateChange.addListener((newState) => {
        const isRegistered = newState === RegistererStateEnum.Registered
        this.updateState({ isRegistered })
        console.log(`Registration state: ${newState}`)
      })

      // Start user agent
      await this.userAgent.start()

      // Register
      await this.registerer.register()

      console.log('WebRTC Softphone connected and registered')
    } catch (error) {
      console.error('Error connecting WebRTC softphone:', error)
      throw error
    }
  }

  /**
   * Disconnect and unregister
   */
  async disconnect(): Promise<void> {
    try {
      if (this.callState.currentSession) {
        await this.hangup()
      }
      if (this.registerer) {
        await this.registerer.unregister()
      }
      if (this.userAgent) {
        await this.userAgent.stop()
      }
      this.updateState({
        isRegistered: false,
        isInCall: false,
        currentSession: null,
        callStatus: 'idle',
      })
      console.log('WebRTC Softphone disconnected')
    } catch (error) {
      console.error('Error disconnecting WebRTC softphone:', error)
    }
  }

  /**
   * Make an outbound call
   */
  async dial(phoneNumber: string): Promise<void> {
    if (!this.userAgent || !this.callState.isRegistered) {
      throw new Error('Softphone not registered')
    }

    if (this.callState.isInCall) {
      throw new Error('Already in a call')
    }

    try {
      const domain = this.config.server.replace(/^wss?:\/\//, '').split('/')[0].split(':')[0]
      const targetURI = UserAgent.makeURI(`sip:${phoneNumber}@${domain}`)
      
      const inviter = new Inviter(this.userAgent, targetURI, {
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false,
          },
        },
      })

      // Handle session state changes
      inviter.stateChange.addListener((newState) => {
        this.handleSessionStateChange(inviter, newState, phoneNumber)
      })

      // Invite (start the call)
      await inviter.invite()

      this.updateState({
        currentSession: inviter,
        isInCall: true,
        callStatus: 'ringing',
        remoteNumber: phoneNumber,
      })
    } catch (error) {
      console.error('Error making call:', error)
      this.updateState({
        isInCall: false,
        callStatus: 'idle',
        currentSession: null,
      })
      throw error
    }
  }

  /**
   * Answer an incoming call
   */
  async answer(): Promise<void> {
    if (!this.callState.currentSession || !(this.callState.currentSession instanceof Invitation)) {
      throw new Error('No incoming call to answer')
    }

    try {
      const invitation = this.callState.currentSession as Invitation
      await invitation.accept()
      this.updateState({
        isInCall: true,
        callStatus: 'connected',
      })
    } catch (error) {
      console.error('Error answering call:', error)
      throw error
    }
  }

  /**
   * Reject an incoming call
   */
  async reject(): Promise<void> {
    if (!this.callState.currentSession || !(this.callState.currentSession instanceof Invitation)) {
      throw new Error('No incoming call to reject')
    }

    try {
      const invitation = this.callState.currentSession as Invitation
      await invitation.reject()
      this.updateState({
        isInCall: false,
        callStatus: 'idle',
        currentSession: null,
        remoteNumber: null,
      })
    } catch (error) {
      console.error('Error rejecting call:', error)
      throw error
    }
  }

  /**
   * Hangup current call
   */
  async hangup(): Promise<void> {
    if (!this.callState.currentSession) {
      return
    }

    try {
      await this.callState.currentSession.bye()
      this.updateState({
        isInCall: false,
        callStatus: 'ended',
        currentSession: null,
        remoteNumber: null,
      })

      // Clean up audio
      if (this.remoteAudioElement) {
        this.remoteAudioElement.pause()
        this.remoteAudioElement.srcObject = null
        this.remoteAudioElement = null
      }
    } catch (error) {
      console.error('Error hanging up:', error)
    } finally {
      // Reset state after a moment
      setTimeout(() => {
        this.updateState({
          callStatus: 'idle',
        })
      }, 1000)
    }
  }

  /**
   * Mute/unmute microphone
   */
  async mute(mute: boolean): Promise<void> {
    if (!this.callState.currentSession) {
      return
    }

    try {
      const sessionDescriptionHandler = this.callState.currentSession.sessionDescriptionHandler
      if (sessionDescriptionHandler && 'mute' in sessionDescriptionHandler) {
        // @ts-ignore
        await sessionDescriptionHandler.mute(mute)
      }
    } catch (error) {
      console.error('Error muting/unmuting:', error)
    }
  }

  /**
   * Hold/unhold call
   */
  async hold(hold: boolean): Promise<void> {
    if (!this.callState.currentSession) {
      return
    }

    try {
      if (hold) {
        await this.callState.currentSession.hold()
      } else {
        await this.callState.currentSession.unhold()
      }
    } catch (error) {
      console.error('Error holding/unholding:', error)
    }
  }

  /**
   * Get current call state
   */
  getState(): CallState {
    return { ...this.callState }
  }

  /**
   * Check if registered
   */
  get isRegistered(): boolean {
    return this.callState.isRegistered
  }

  /**
   * Handle incoming call
   */
  private handleIncomingCall(invitation: Invitation): void {
    console.log('Incoming call received')

    // Get caller information
    const from = invitation.request.from
    const remoteNumber = from?.uri?.user || 'Unknown'

    invitation.stateChange.addListener((newState) => {
      this.handleSessionStateChange(invitation, newState, remoteNumber)
    })

    this.updateState({
      currentSession: invitation,
      callStatus: 'ringing',
      remoteNumber: remoteNumber,
    })
  }

  /**
   * Handle session state changes
   */
  private handleSessionStateChange(session: Session, state: SessionState, remoteNumber: string): void {
    console.log(`Session state changed: ${state} for ${remoteNumber}`)

    switch (state) {
      case SessionState.Established:
        this.setupAudio(session)
        this.updateState({
          isInCall: true,
          callStatus: 'connected',
        })
        break

      case SessionState.Terminated:
        this.updateState({
          isInCall: false,
          callStatus: 'ended',
          currentSession: null,
          remoteNumber: null,
        })
        if (this.remoteAudioElement) {
          this.remoteAudioElement.pause()
          this.remoteAudioElement.srcObject = null
          this.remoteAudioElement = null
        }
        break

      case SessionState.Initial:
      case SessionState.Establishing:
        this.updateState({
          callStatus: 'ringing',
        })
        break
    }
  }

  /**
   * Setup audio for the call
   */
  private setupAudio(session: Session): void {
    try {
      const sessionDescriptionHandler = session.sessionDescriptionHandler
      if (sessionDescriptionHandler && 'remoteStream' in sessionDescriptionHandler) {
        // @ts-ignore
        const remoteStream = sessionDescriptionHandler.remoteStream as MediaStream

        // Create audio element if it doesn't exist
        if (!this.remoteAudioElement) {
          this.remoteAudioElement = new Audio()
          this.remoteAudioElement.autoplay = true
          this.remoteAudioElement.srcObject = remoteStream
        } else {
          this.remoteAudioElement.srcObject = remoteStream
        }

        this.updateState({
          remoteAudio: this.remoteAudioElement,
        })
      }
    } catch (error) {
      console.error('Error setting up audio:', error)
    }
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<CallState>): void {
    this.callState = { ...this.callState, ...updates }
    this.onStateChange({ ...this.callState })
  }
}
