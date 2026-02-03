'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/shared/DashboardLayout'
import AgentAddEditModal from '@/components/shared/AgentAddEditModal'
import CampaignAddEditModal from '@/components/shared/CampaignAddEditModal'
import { adminAPI } from '@/lib/api'
import type { AgentStats, AdminSummaryStats, Agent, Campaign } from '@/lib/api'

export default function AdminPage() {
	const router = useRouter()
	const [loading, setLoading] = useState(true)
	const [isAdmin, setIsAdmin] = useState(false)
	const [agents, setAgents] = useState<Agent[]>([])
	const [agentsStats, setAgentsStats] = useState<AgentStats[]>([])
	const [summaryStats, setSummaryStats] = useState<AdminSummaryStats | null>(null)
	const [currentTime, setCurrentTime] = useState(new Date())
	const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'agents' | 'campaigns'>('overview')
	const [showAgentModal, setShowAgentModal] = useState(false)
	const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
	const [agentSearchQuery, setAgentSearchQuery] = useState('')
	const [campaigns, setCampaigns] = useState<Campaign[]>([])
	const [showCampaignModal, setShowCampaignModal] = useState(false)
	const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
	const [campaignSearchQuery, setCampaignSearchQuery] = useState('')

	useEffect(() => {
		const checkAdminAuth = async () => {
			const token = localStorage.getItem('access_token')
			const agentData = JSON.parse(localStorage.getItem('agent_data') || '{}')

			if (!token || !agentData.is_admin) {
				router.push('/login')
				return
			}
			setIsAdmin(true)
			
			try {
				const [agentsData, statsData, summaryData, campaignsData] = await Promise.all([
					adminAPI.listAgents(),
					adminAPI.getAllAgentsStats(),
					adminAPI.getSummaryStats(),
					adminAPI.listCampaigns()
				])
				setAgents(agentsData)
				setAgentsStats(statsData)
				setSummaryStats(summaryData)
				setCampaigns(campaignsData)
			} catch (error) {
				console.error('Error loading admin data:', error)
			} finally {
				setLoading(false)
			}
		}
		
		checkAdminAuth()

		const interval = setInterval(() => {
			setCurrentTime(new Date())
		}, 1000)

		return () => clearInterval(interval)
	}, [router])

	const loadAgents = async () => {
		try {
			const agentsData = await adminAPI.listAgents()
			setAgents(agentsData)
		} catch (error) {
			console.error('Error loading agents:', error)
		}
	}

	const handleCreateAgent = () => {
		setEditingAgent(null)
		setShowAgentModal(true)
	}

	const handleEditAgent = (agent: Agent) => {
		setEditingAgent(agent)
		setShowAgentModal(true)
	}

	const handleAgentModalClose = () => {
		setShowAgentModal(false)
		setEditingAgent(null)
	}

	const handleAgentModalSuccess = () => {
		loadAgents()
		// Also reload stats to update agent counts
		adminAPI.getAllAgentsStats().then(setAgentsStats).catch(console.error)
		adminAPI.getSummaryStats().then(setSummaryStats).catch(console.error)
	}

	const loadCampaigns = async () => {
		try {
			const campaignsData = await adminAPI.listCampaigns()
			setCampaigns(campaignsData)
		} catch (error) {
			console.error('Error loading campaigns:', error)
		}
	}

	const handleCreateCampaign = () => {
		setEditingCampaign(null)
		setShowCampaignModal(true)
	}

	const handleEditCampaign = (campaign: Campaign) => {
		setEditingCampaign(campaign)
		setShowCampaignModal(true)
	}

	const handleDeleteCampaign = async (campaignId: number, campaignName: string) => {
		if (!confirm(`Are you sure you want to delete campaign "${campaignName}"? This action cannot be undone.`)) {
			return
		}

		try {
			await adminAPI.deleteCampaign(campaignId)
			alert('Campaign deleted successfully!')
			loadCampaigns()
		} catch (error: any) {
			alert(`Error: ${error.response?.data?.detail || error.message}`)
		}
	}

	const handleCampaignModalSuccess = () => {
		loadCampaigns()
	}

	const filteredCampaigns = campaigns.filter((campaign) => {
		const query = campaignSearchQuery.toLowerCase().trim()
		if (!query) return true
		
		return (
			campaign.name.toLowerCase().includes(query) ||
			campaign.code.toLowerCase().includes(query) ||
			(campaign.description && campaign.description.toLowerCase().includes(query))
		)
	})

	const filteredAgents = agents.filter((agent) => {
		const query = agentSearchQuery.toLowerCase().trim()
		if (!query) return true
		
		return (
			agent.username.toLowerCase().includes(query) ||
			(agent.full_name && agent.full_name.toLowerCase().includes(query)) ||
			agent.phone_extension.toLowerCase().includes(query) ||
			agent.status.toLowerCase().includes(query)
		)
	})

	const formatDateTime = (date: Date) => {
		return date.toLocaleString('en-US', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		})
	}

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
				<div className="text-xl text-slate-700 dark:text-slate-300">Loading...</div>
			</div>
		)
	}

	if (!isAdmin) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
				<div className="text-xl text-red-600 dark:text-red-400">Access Denied: Admin access required</div>
			</div>
		)
	}

	return (
		<>
		<DashboardLayout
			timeString={formatDateTime(currentTime)}
			title="Admin Dashboard"
		>
			<div className="space-y-6">
				{/* Tabs */}
				<div className="border-b border-slate-200 dark:border-slate-700">
					<nav className="-mb-px flex space-x-8" aria-label="Tabs">
						<button
							onClick={() => setActiveTab('overview')}
							className={`${
								activeTab === 'overview'
									? 'border-blue-500 text-blue-600 dark:text-blue-400'
									: 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
							} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200`}
						>
							Overview
						</button>
						<button
							onClick={() => setActiveTab('agents')}
							className={`${
								activeTab === 'agents'
									? 'border-blue-500 text-blue-600 dark:text-blue-400'
									: 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
							} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200`}
						>
							Agents
						</button>
						<button
							onClick={() => setActiveTab('campaigns')}
							className={`${
								activeTab === 'campaigns'
									? 'border-blue-500 text-blue-600 dark:text-blue-400'
									: 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
							} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200`}
						>
							Campaigns
						</button>
						<button
							onClick={() => setActiveTab('performance')}
							className={`${
								activeTab === 'performance'
									? 'border-blue-500 text-blue-600 dark:text-blue-400'
									: 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
							} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200`}
						>
							Performance Graphs
						</button>
					</nav>
				</div>

				{/* Overview Tab */}
				{activeTab === 'overview' && summaryStats && (
					<div className="space-y-6">
						{/* Summary Cards */}
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
							<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-slate-600 dark:text-slate-400">Total Agents</p>
										<p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{summaryStats.total_agents}</p>
										<p className="text-xs text-green-600 dark:text-green-400 mt-1">{summaryStats.active_agents} active</p>
									</div>
									<div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
										<svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
										</svg>
									</div>
								</div>
							</div>

							<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-slate-600 dark:text-slate-400">Total Calls</p>
										<p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{summaryStats.total_calls}</p>
										<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
											{summaryStats.total_inbound_calls} in / {summaryStats.total_outbound_calls} out
										</p>
									</div>
									<div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
										<svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
										</svg>
									</div>
								</div>
							</div>

							<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-slate-600 dark:text-slate-400">Answer Rate</p>
										<p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{summaryStats.overall_answer_rate}%</p>
										<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
											{summaryStats.total_abandoned_calls} abandoned
										</p>
									</div>
									<div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
										<svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
										</svg>
									</div>
								</div>
							</div>

							<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-slate-600 dark:text-slate-400">Abandoned Calls</p>
										<p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{summaryStats.total_abandoned_calls}</p>
										<p className="text-xs text-red-600 dark:text-red-400 mt-1">
											{summaryStats.total_calls > 0 ? Math.round((summaryStats.total_abandoned_calls / summaryStats.total_calls) * 100) : 0}% of total
										</p>
									</div>
									<div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
										<svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
										</svg>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Agents Tab */}
				{activeTab === 'agents' && (
					<div className="space-y-6">
						<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-card">
							<div className="p-6">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
										All Agents ({filteredAgents.length}{agentSearchQuery ? ` of ${agents.length}` : ''})
									</h2>
									<button
										onClick={handleCreateAgent}
										className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
									>
										+ Create Agent
									</button>
								</div>
								{/* Search Bar */}
								<div className="mb-4">
									<div className="relative">
										<input
											type="text"
											placeholder="Search agents by username, name, extension, or status..."
											value={agentSearchQuery}
											onChange={(e) => setAgentSearchQuery(e.target.value)}
											className="w-full px-4 py-2 pl-10 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
										<svg
											className="absolute left-3 top-2.5 h-5 w-5 text-slate-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
										</svg>
										{agentSearchQuery && (
											<button
												onClick={() => setAgentSearchQuery('')}
												className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
											>
												<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										)}
									</div>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full">
										<thead>
											<tr className="border-b border-slate-200 dark:border-slate-700">
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Username</th>
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Full Name</th>
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Extension</th>
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Status</th>
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Role</th>
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
											</tr>
										</thead>
										<tbody>
											{filteredAgents.length === 0 ? (
												<tr>
													<td colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">
														{agentSearchQuery ? 'No agents match your search' : 'No agents found'}
													</td>
												</tr>
											) : (
												filteredAgents.map((agent) => (
													<tr key={agent.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
														<td className="py-3 px-4 text-slate-900 dark:text-slate-100">{agent.username}</td>
														<td className="py-3 px-4 text-slate-900 dark:text-slate-100">{agent.full_name || '-'}</td>
														<td className="py-3 px-4 text-slate-900 dark:text-slate-100">{agent.phone_extension}</td>
														<td className="py-3 px-4">
															<span className={`px-2 py-1 rounded text-xs font-medium ${
																agent.status === 'available' 
																	? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
																	: agent.status === 'in_call'
																	? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
																	: 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
															}`}>
																{agent.status}
															</span>
														</td>
														<td className="py-3 px-4">
															{agent.is_admin ? (
																<span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
																	Admin
																</span>
															) : (
																<span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300">
																	Agent
																</span>
															)}
														</td>
														<td className="py-3 px-4">
															<button 
																onClick={() => handleEditAgent(agent)}
																className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
															>
																Edit
															</button>
														</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Campaigns Tab */}
				{activeTab === 'campaigns' && (
					<div className="space-y-6">
						<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-card">
							<div className="p-6">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
										All Campaigns ({filteredCampaigns.length}{campaignSearchQuery ? ` of ${campaigns.length}` : ''})
									</h2>
									<button
										onClick={handleCreateCampaign}
										className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
									>
										+ Create Campaign
									</button>
								</div>
								{/* Search Bar */}
								<div className="mb-4">
									<div className="relative">
										<input
											type="text"
											placeholder="Search campaigns by name, code, or description..."
											value={campaignSearchQuery}
											onChange={(e) => setCampaignSearchQuery(e.target.value)}
											className="w-full px-4 py-2 pl-10 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
										<svg
											className="absolute left-3 top-2.5 h-5 w-5 text-slate-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
										</svg>
										{campaignSearchQuery && (
											<button
												onClick={() => setCampaignSearchQuery('')}
												className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
											>
												<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										)}
									</div>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full">
										<thead>
											<tr className="border-b border-slate-200 dark:border-slate-700">
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Name</th>
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Code</th>
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Description</th>
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Status</th>
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Dial Method</th>
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Created</th>
												<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
											</tr>
										</thead>
										<tbody>
											{filteredCampaigns.length === 0 ? (
												<tr>
													<td colSpan={7} className="text-center py-8 text-slate-500 dark:text-slate-400">
														{campaignSearchQuery ? 'No campaigns match your search' : 'No campaigns found'}
													</td>
												</tr>
											) : (
												filteredCampaigns.map((campaign) => (
													<tr key={campaign.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
														<td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{campaign.name}</td>
														<td className="py-3 px-4 text-slate-900 dark:text-slate-100">
															<span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-mono">
																{campaign.code}
															</span>
														</td>
														<td className="py-3 px-4 text-slate-900 dark:text-slate-100">{campaign.description || '-'}</td>
														<td className="py-3 px-4">
															<span className={`px-2 py-1 rounded text-xs font-medium ${
																campaign.status === 'active' 
																	? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
																	: campaign.status === 'paused'
																	? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
																	: 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
															}`}>
																{campaign.status}
															</span>
														</td>
														<td className="py-3 px-4 text-slate-900 dark:text-slate-100 capitalize">{campaign.dial_method}</td>
														<td className="py-3 px-4 text-slate-900 dark:text-slate-100 text-sm">
															{new Date(campaign.created_at).toLocaleDateString()}
														</td>
														<td className="py-3 px-4">
															<div className="flex space-x-2">
																<button 
																	onClick={() => handleEditCampaign(campaign)}
																	className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
																>
																	Edit
																</button>
																<button 
																	onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
																	className="text-red-600 dark:text-red-400 hover:underline text-sm"
																>
																	Delete
																</button>
															</div>
														</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Performance Graphs Tab */}
				{activeTab === 'performance' && (
					<div className="space-y-6">
						<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
							<h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Agent Performance Overview</h2>
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b border-slate-200 dark:border-slate-700">
											<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Agent</th>
											<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Inbound</th>
											<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Outbound</th>
											<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Total</th>
											<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Abandoned</th>
											<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Answer Rate</th>
											<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Avg Duration</th>
										</tr>
									</thead>
									<tbody>
										{agentsStats.length === 0 ? (
											<tr>
												<td colSpan={7} className="text-center py-8 text-slate-500 dark:text-slate-400">
													No agent statistics available
												</td>
											</tr>
										) : (
											agentsStats.map((stat) => (
												<tr key={stat.agent_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
													<td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">{stat.full_name || stat.username}</td>
													<td className="py-3 px-4 text-slate-900 dark:text-slate-100">{stat.inbound_calls}</td>
													<td className="py-3 px-4 text-slate-900 dark:text-slate-100">{stat.outbound_calls}</td>
													<td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-semibold">{stat.total_calls}</td>
													<td className="py-3 px-4 text-red-600 dark:text-red-400">{stat.abandoned_calls}</td>
													<td className="py-3 px-4">
														<div className="flex items-center space-x-2">
															<span className="text-slate-900 dark:text-slate-100">{stat.answer_rate}%</span>
															<div className="w-20 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
																<div 
																	className="bg-blue-600 h-2 rounded-full" 
																	style={{ width: `${stat.answer_rate}%` }}
																></div>
															</div>
														</div>
													</td>
													<td className="py-3 px-4 text-slate-900 dark:text-slate-100">
														{stat.avg_call_duration > 0 ? `${Math.floor(stat.avg_call_duration / 60)}m ${stat.avg_call_duration % 60}s` : '-'}
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>

						{/* Performance Bar Chart */}
						<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-card">
							<h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Calls by Agent (Today)</h2>
							{agentsStats.length === 0 ? (
								<div className="text-center py-8 text-slate-500 dark:text-slate-400">
									No agent statistics available
								</div>
							) : (
								<div className="space-y-4">
									{agentsStats.map((stat) => (
										<div key={stat.agent_id}>
											<div className="flex justify-between mb-1">
												<span className="text-sm font-medium text-slate-700 dark:text-slate-300">{stat.full_name || stat.username}</span>
												<span className="text-sm text-slate-600 dark:text-slate-400">{stat.total_calls} calls</span>
											</div>
											<div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-6">
												<div 
													className="bg-blue-600 h-6 rounded-full flex items-center justify-end pr-2"
													style={{ width: `${(stat.total_calls / Math.max(...agentsStats.map(s => s.total_calls), 1)) * 100}%` }}
												>
													{stat.total_calls > 0 && (
														<span className="text-xs text-white font-semibold">{stat.total_calls}</span>
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</DashboardLayout>
		{showAgentModal && (
			<AgentAddEditModal
				agent={editingAgent}
				onClose={handleAgentModalClose}
				onSuccess={handleAgentModalSuccess}
			/>
		)}
		{showCampaignModal && (
			<CampaignAddEditModal
				campaign={editingCampaign}
				onClose={() => {
					setShowCampaignModal(false)
					setEditingCampaign(null)
				}}
				onSuccess={handleCampaignModalSuccess}
			/>
		)}
		</>
	)
}