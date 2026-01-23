'use client'

import { useEffect } from 'react'

export default function ThemeInitializer() {
	useEffect(() => {
		const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
		const shouldDark = stored ? stored === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
		if (shouldDark) {
			document.documentElement.classList.add('dark')
		} else {
			document.documentElement.classList.remove('dark')
		}
	}, [])

	return null
}

