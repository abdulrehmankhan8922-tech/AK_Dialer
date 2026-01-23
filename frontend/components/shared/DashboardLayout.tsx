'use client'

import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { ReactNode } from 'react'

type Props = {
	children: ReactNode
	timeString?: string
	title?: string
}

export default function DashboardLayout({ children, timeString, title }: Props) {
	return (
		<div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
			<div className="flex h-screen">
				<Sidebar />
				<div className="flex-1 flex flex-col">
					<Topbar timeString={timeString} title={title} />
					<main className="flex-1 overflow-y-auto p-4 md:p-6">
						{children}
					</main>
				</div>
			</div>
		</div>
	)
}

