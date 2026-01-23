'use client'

import { useState, useEffect } from 'react'
import { callsAPI, contactsAPI } from '@/lib/api'
import type { Call, Contact } from '@/lib/api'

interface IncomingCallModalProps {
  call: Call
  onAnswer: () => void
  onReject: () => void
}

export default function IncomingCallModal({ call, onAnswer, onReject }: IncomingCallModalProps) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Try to find contact by phone number
    const findContact = async () => {
      try {
        const contacts = await contactsAPI.list()
        const found = contacts.find(c => c.phone === call.phone_number)
        if (found) {
          setContact(found)
        }
      } catch (error) {
        console.error('Error fetching contact:', error)
      }
    }
    findContact()
  }, [call.phone_number])

  const handleAnswer = async () => {
    setLoading(true)
    try {
      await callsAPI.answerInbound(call.id)
      onAnswer()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error answering call')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    setLoading(true)
    try {
      await callsAPI.rejectInbound(call.id)
      onReject()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error rejecting call')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl border-4 border-blue-500 animate-pulse">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Incoming Call</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 font-mono">{call.phone_number}</p>
        </div>

        {contact && (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Contact Information</h3>
            <p className="text-slate-900 dark:text-slate-100 font-medium">{contact.name || 'Unknown'}</p>
            {contact.city && (
              <p className="text-sm text-slate-600 dark:text-slate-400">{contact.city}</p>
            )}
            {contact.occupation && (
              <p className="text-sm text-slate-600 dark:text-slate-400">{contact.occupation}</p>
            )}
          </div>
        )}

        <div className="flex space-x-4">
          <button
            onClick={handleAnswer}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold text-lg transition-colors shadow-lg flex items-center justify-center space-x-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>{loading ? 'Answering...' : 'Answer'}</span>
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold text-lg transition-colors shadow-lg flex items-center justify-center space-x-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M6 12a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
            <span>{loading ? 'Rejecting...' : 'Reject'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
