'use client'

import { useRouter } from 'next/navigation'
import { authAPI } from '@/lib/api'
import ThemeToggle from './ThemeToggle'

type Props = {
	timeString?: string
	title?: string
}

export default function Topbar({ timeString, title }: Props) {
	const router = useRouter()

	const onLogout = async () => {
		try {
			await authAPI.logout()
		} catch {}
		router.push('/login')
	}

	return (
		<header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4">
			<div className="flex items-center space-x-4">
				{title && (
					<h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
				)}
			</div>
			<div className="flex items-center space-x-4">
				{timeString && (
					<div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-300">
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span className="font-medium">{timeString}</span>
					</div>
				)}
				<ThemeToggle />
				<button
					onClick={onLogout}
					className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
				>
					Logout
				</button>
			</div>
		</header>
	)
}

