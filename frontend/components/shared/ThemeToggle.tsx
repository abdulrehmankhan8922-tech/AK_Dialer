'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
	const [isDark, setIsDark] = useState(false)

	useEffect(() => {
		const stored = localStorage.getItem('theme')
		if (stored) {
			setIsDark(stored === 'dark')
		} else {
			setIsDark(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
		}
	}, [])

	const toggle = () => {
		const next = !isDark
		setIsDark(next)
		if (next) {
			document.documentElement.classList.add('dark')
			localStorage.setItem('theme', 'dark')
		} else {
			document.documentElement.classList.remove('dark')
			localStorage.setItem('theme', 'light')
		}
	}

	return (
		<button
			onClick={toggle}
			className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
			title="Toggle theme"
		>
			{isDark ? 'Light' : 'Dark'}
		</button>
	)
}

