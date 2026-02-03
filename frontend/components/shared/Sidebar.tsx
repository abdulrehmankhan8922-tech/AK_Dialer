'use client'

import { usePathname, useRouter } from 'next/navigation'
import React, { useState, useEffect } from 'react'

type NavItem = {
	key: string
	label: string
	path: string
	icon: React.ReactNode
	adminOnly?: boolean
}

const navItems: NavItem[] = [
	{
		key: 'admin',
		label: 'Admin',
		path: '/admin',
		icon: (
			<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
		),
		adminOnly: true,
	},
	{
		key: 'dialer',
		label: 'Dialer',
		path: '/dialer',
		icon: (
			<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.69l1.5 4.48a1 1 0 01-.5 1.21l-2.26 1.13a11.04 11.04 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.48 1.5a1 1 0 01.69.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
			</svg>
		),
	},
	{
		key: 'script',
		label: 'Script',
		path: '/script',
		icon: (
			<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M9 8h6m2 11a2 2 0 002-2V7a2 2 0 00-2-2h-3l-2-2H8L6 5H3a2 2 0 00-2 2v10a2 2 0 002 2h14z" />
			</svg>
		),
	},
	{
		key: 'contacts',
		label: 'Contacts',
		path: '/contacts',
		icon: (
			<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V10a2 2 0 00-2-2h-3M9 20H4v-7a2 2 0 012-2h3m4 0a4 4 0 100-8 4 4 0 000 8zm6 8v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2" />
			</svg>
		),
	},
	{
		key: 'reports',
		label: 'Reports',
		path: '/reports',
		icon: (
			<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 11V3a1 1 0 112 0v8a1 1 0 01-2 0zm6 4V3a1 1 0 112 0v12a1 1 0 01-2 0zM5 7V3a1 1 0 112 0v4a1 1 0 01-2 0zm0 10v-4a1 1 0 112 0v4a1 1 0 11-2 0z" />
			</svg>
		),
	},
	{
		key: 'asterisk',
		label: 'Asterisk Config',
		path: '/admin/asterisk',
		icon: (
			<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
		),
		adminOnly: true,
	},
	{
		key: 'settings',
		label: 'Settings',
		path: '/settings',
		icon: (
			<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0a1.724 1.724 0 002.573 1.066c.78-.475 1.757.502 1.282 1.282a1.724 1.724 0 001.065 2.572c.921.3.921 1.603 0 1.902a1.724 1.724 0 00-1.066 2.573c.475.78-.502 1.757-1.282 1.282a1.724 1.724 0 00-2.572 1.065c-.3.921-1.603.921-1.902 0a1.724 1.724 0 00-2.573-1.066c-.78.475-1.757-.502-1.282-1.282a1.724 1.724 0 00-1.065-2.572c-.921-.3-.921-1.603 0-1.902a1.724 1.724 0 001.066-2.573c-.475-.78.502-1.757 1.282-1.282a1.724 1.724 0 002.572-1.065z" />
			</svg>
		),
	},
]

export default function Sidebar() {
	const pathname = usePathname()
	const router = useRouter()
	const [isAdmin, setIsAdmin] = useState(false)

	useEffect(() => {
		const agentData = localStorage.getItem('agent_data')
		if (agentData) {
			try {
				const data = JSON.parse(agentData)
				setIsAdmin(data.is_admin === true || data.is_admin === 1)
			} catch (e) {
				setIsAdmin(false)
			}
		}
	}, [])

	const go = (path: string) => {
		if (path === '#') return
		router.push(path)
	}

	const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin)

	return (
		<aside className="h-full w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100">
			<div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
				<div className="flex items-center space-x-3">
					<div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow">
						<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.69l1.5 4.48a1 1 0 01-.5 1.21l-2.26 1.13a11.04 11.04 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.48 1.5a1 1 0 01.69.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
						</svg>
					</div>
					<div>
						<div className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">Dialer</div>
						<div className="text-xs text-slate-500 dark:text-slate-400">{isAdmin ? 'Admin Console' : 'Agent Console'}</div>
					</div>
				</div>
			</div>

			<nav className="px-3 py-4 space-y-1">
				{visibleNavItems.map(item => {
					const active = pathname === item.path
					return (
						<button
							key={item.key}
							onClick={() => go(item.path)}
							className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
								active
									? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-slate-800 dark:text-white dark:border-slate-700'
									: 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-transparent dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
							}`}
						>
							<span>{item.icon}</span>
							<span className="text-sm font-medium">{item.label}</span>
						</button>
					)
				})}
			</nav>
		</aside>
	)
}

