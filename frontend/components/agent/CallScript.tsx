'use client'

import { useState } from 'react'

interface CallScriptProps {
  campaignCode?: string
}

const SCRIPTS: Record<string, string[]> = {
  default: [
    'Hello, this is [Your Name] calling from [Company Name].',
    'I\'m reaching out regarding [Campaign Purpose].',
    'Is this a good time to speak?',
    'Thank you for your time. Have a great day!',
  ],
  J7GC4: [
    'Good [morning/afternoon], this is [Your Name] from [Company Name].',
    'I\'m calling about our special offer for [Campaign Name].',
    'Would you be interested in learning more?',
    'Thank you for your time today.',
  ],
}

export default function CallScript({ campaignCode }: CallScriptProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const script = SCRIPTS[campaignCode || 'default'] || SCRIPTS.default

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Call Script</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded disabled:opacity-50"
          >
            ← Prev
          </button>
          <button
            onClick={() => setCurrentStep(Math.min(script.length - 1, currentStep + 1))}
            disabled={currentStep === script.length - 1}
            className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 min-h-[200px]">
        <div className="text-xs text-blue-600 dark:text-blue-400 mb-2">
          Step {currentStep + 1} of {script.length}
        </div>
        <div className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-line">
          {script[currentStep]}
        </div>
      </div>

      <div className="flex space-x-1 justify-center">
        {script.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentStep(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentStep
                ? 'bg-blue-600 w-6'
                : 'bg-slate-300 dark:bg-slate-600'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
