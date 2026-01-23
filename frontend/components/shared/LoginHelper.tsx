'use client'

export default function LoginHelper() {
  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6 backdrop-blur-sm">
      <div className="flex items-start space-x-3">
        <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1 text-sm text-gray-300">
          <p className="font-semibold text-blue-400 mb-2">Unified Login - Agent or Admin:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold text-white mb-1">👤 Agent Login:</p>
              <ul className="space-y-0.5 text-gray-300">
                <li>• Phone/User: <strong>8013</strong></li>
                <li>• Password: <strong>password</strong></li>
                <li>• Campaign: Select one</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white mb-1">⚙️ Admin Login:</p>
              <ul className="space-y-0.5 text-gray-300">
                <li>• Phone/User: <strong>admin</strong></li>
                <li>• Password: <strong>admin</strong></li>
                <li>• Campaign: Optional</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
