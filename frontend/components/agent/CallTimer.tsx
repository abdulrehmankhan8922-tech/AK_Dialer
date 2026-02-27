'use client'

import { useState, useEffect } from 'react'
import type { Call } from '@/lib/api'

interface CallTimerProps {
  call: Call | null
}

export default function CallTimer({ call }: CallTimerProps) {
  const [ringDuration, setRingDuration] = useState(0)
  const [talkDuration, setTalkDuration] = useState(0)

  useEffect(() => {
    if (!call) {
      setRingDuration(0)
      setTalkDuration(0)
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      
      // Calculate ring duration (from ring_time to now or answered_time)
      if (call.ring_time) {
        const ringStart = new Date(call.ring_time).getTime()
        const ringEnd = call.answered_time ? new Date(call.answered_time).getTime() : now
        const ringElapsed = Math.floor((ringEnd - ringStart) / 1000)
        setRingDuration(Math.max(0, ringElapsed))
      }
      
      // Calculate talk duration (from answered_time to now or end_time)
      if (call.answered_time) {
        const talkStart = new Date(call.answered_time).getTime()
        const talkEnd = call.end_time ? new Date(call.end_time).getTime() : now
        const talkElapsed = Math.floor((talkEnd - talkStart) / 1000)
        setTalkDuration(Math.max(0, talkElapsed))
      } else if (call.ring_duration) {
        // Use stored ring_duration if available
        setRingDuration(call.ring_duration)
      }
      
      // Use stored talk_duration if call ended
      if (call.end_time && call.talk_duration) {
        setTalkDuration(call.talk_duration)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [call])

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Don't show for ended or failed calls
  if (!call || call.status === 'ended' || call.status === 'failed') {
    return null
  }

  const isDialing = call.status === 'dialing'
  const isRinging = call.status === 'ringing'
  const isAnswered = call.status === 'answered' || call.status === 'connected'

  // Calculate total elapsed time from start
  const getTotalElapsed = () => {
    if (call.start_time) {
      const start = new Date(call.start_time).getTime()
      const now = Date.now()
      return Math.floor((now - start) / 1000)
    }
    return 0
  }

  return (
    <div className="flex items-center space-x-4 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
      {/* Show dialing indicator */}
      {isDialing && (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-600 dark:text-slate-400">Dialing</span>
            <span className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatTime(getTotalElapsed())}
            </span>
          </div>
        </div>
      )}

      {/* Ring Duration - Show when ringing or if call was answered */}
      {(isRinging || (isAnswered && (ringDuration > 0 || call.ring_duration > 0))) && (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-600 dark:text-slate-400">Ring</span>
            <span className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatTime(ringDuration || call.ring_duration || 0)}
            </span>
          </div>
        </div>
      )}
      
      {/* Talk Duration - Show when call is answered */}
      {isAnswered && (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-600 dark:text-slate-400">Talk</span>
            <span className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatTime(talkDuration || call.talk_duration || 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
