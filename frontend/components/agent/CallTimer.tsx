'use client'

import { useState, useEffect } from 'react'
import type { Call } from '@/lib/api'

interface CallTimerProps {
  call: Call | null
}

export default function CallTimer({ call }: CallTimerProps) {
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!call || call.status === 'ended' || call.status === 'failed') {
      setDuration(0)
      return
    }

    const startTime = call.start_time ? new Date(call.start_time).getTime() : Date.now()
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      setDuration(elapsed)
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

  if (!call || (call.status !== 'connected' && call.status !== 'answered' && call.status !== 'ringing')) {
    return null
  }

  return (
    <div className="flex items-center space-x-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      <span className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
        {formatTime(duration)}
      </span>
    </div>
  )
}
