import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Handle 401 errors - but don't auto-redirect for all 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect if we're not already on login page
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      console.error('Authentication error:', error)
      localStorage.removeItem('access_token')
      localStorage.removeItem('agent_data')
      // Don't auto-redirect, let components handle it
    }
    return Promise.reject(error)
  }
)

export interface LoginRequest {
  username: string
  password: string
  campaign?: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  agent_id: number
  username: string
  session_id: string
  campaign_id?: number
  campaign_code?: string
  is_admin?: boolean
}

export interface Agent {
  id: number
  username: string
  phone_extension: string
  full_name?: string
  status: string
  is_admin?: boolean
  created_at?: string
}

export interface Campaign {
  id: number
  name: string
  code: string
  description?: string
  status: string
  dial_method: string
}

export interface Call {
  id: number
  agent_id?: number
  campaign_id?: number
  contact_id?: number
  phone_number: string
  direction: string
  status: string
  start_time: string
  end_time?: string
  duration: number
  call_unique_id?: string
  is_muted?: boolean
  is_on_hold?: boolean
}

export interface Contact {
  id: number
  campaign_id: number
  name?: string
  phone: string
  address?: string
  city?: string
  occupation?: string
  gender: string
  whatsapp?: string
  email?: string
  comments?: string
  status: string
}

export interface Stats {
  inbound_calls: number
  outbound_calls: number
  abandoned_calls: number
  total_calls: number
  break_time: string
  login_time: string
  session_id?: string
}

export interface AgentStats {
  agent_id: number
  username: string
  full_name?: string
  status: string
  inbound_calls: number
  outbound_calls: number
  total_calls: number
  abandoned_calls: number
  avg_call_duration: number
  answer_rate: number
}

export interface AdminSummaryStats {
  total_inbound_calls: number
  total_outbound_calls: number
  total_calls: number
  total_abandoned_calls: number
  active_agents: number
  total_agents: number
  overall_answer_rate: number
}

export const authAPI = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/api/auth/login', data)
    localStorage.setItem('access_token', response.data.access_token)
    localStorage.setItem('agent_data', JSON.stringify({
      agent_id: response.data.agent_id,
      username: response.data.username,
      session_id: response.data.session_id,
      campaign_id: response.data.campaign_id,
      campaign_code: response.data.campaign_code,
      is_admin: response.data.is_admin || false,
    }))
    return response.data
  },
  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout')
    localStorage.removeItem('access_token')
    localStorage.removeItem('agent_data')
  },
}

export const agentsAPI = {
  getMe: async (): Promise<Agent> => {
    const response = await api.get<Agent>('/api/agents/me')
    return response.data
  },
  getSession: async () => {
    const response = await api.get('/api/agents/session')
    return response.data
  },
  updateStatus: async (status: string) => {
    const response = await api.post('/api/agents/status', { status })
    return response.data
  },
}

export const campaignsAPI = {
  list: async (): Promise<Campaign[]> => {
    const response = await api.get<{ campaigns: Campaign[] }>('/api/campaigns/')
    return response.data.campaigns
  },
  get: async (id: number): Promise<Campaign> => {
    const response = await api.get<Campaign>(`/api/campaigns/${id}`)
    return response.data
  },
}

export const callsAPI = {
  dial: async (phone_number: string, campaign_id?: number, contact_id?: number): Promise<Call> => {
    const response = await api.post<Call>('/api/calls/dial', {
      phone_number,
      campaign_id,
      contact_id,
    })
    return response.data
  },
  hangup: async (call_id: number): Promise<void> => {
    await api.post(`/api/calls/hangup/${call_id}`)
  },
  transfer: async (call_id: number, target_extension: string): Promise<void> => {
    await api.post(`/api/calls/transfer/${call_id}`, null, {
      params: { target_extension },
    })
  },
  park: async (call_id: number): Promise<void> => {
    await api.post(`/api/calls/park/${call_id}`)
  },
  getCurrent: async (): Promise<Call | null> => {
    try {
      const response = await api.get<{ call: Call | null }>('/api/calls/current')
      return response.data.call
    } catch {
      return null
    }
  },
  getHistory: async (filter: 'all' | 'today' | 'outbound' | 'inbound' = 'today'): Promise<Call[]> => {
    const response = await api.get<Call[]>('/api/calls/history', {
      params: { filter },
    })
    return response.data
  },
  updateDisposition: async (call_id: number, disposition: string, notes?: string): Promise<void> => {
    await api.post(`/api/calls/${call_id}/disposition`, { disposition, notes: notes || '' })
  },
  mute: async (call_id: number): Promise<void> => {
    await api.post(`/api/calls/${call_id}/mute`)
  },
  unmute: async (call_id: number): Promise<void> => {
    await api.post(`/api/calls/${call_id}/unmute`)
  },
  hold: async (call_id: number): Promise<void> => {
    await api.post(`/api/calls/${call_id}/hold`)
  },
  unhold: async (call_id: number): Promise<void> => {
    await api.post(`/api/calls/${call_id}/unhold`)
  },
  answerInbound: async (call_id: number): Promise<void> => {
    await api.post(`/api/calls/inbound/${call_id}/answer`)
  },
  rejectInbound: async (call_id: number): Promise<void> => {
    await api.post(`/api/calls/inbound/${call_id}/reject`)
  },
  startRecording: async (call_id: number): Promise<void> => {
    await api.post(`/api/calls/${call_id}/recording/start`)
  },
  stopRecording: async (call_id: number): Promise<void> => {
    await api.post(`/api/calls/${call_id}/recording/stop`)
  },
  getRecordings: async (call_id: number): Promise<any> => {
    const response = await api.get(`/api/calls/${call_id}/recordings`)
    return response.data
  },
}

export const contactsAPI = {
  list: async (campaign_id?: number): Promise<Contact[]> => {
    const params = campaign_id ? { campaign_id } : {}
    const response = await api.get<Contact[]>('/api/contacts/', { params })
    return response.data
  },
  create: async (data: Partial<Contact>): Promise<Contact> => {
    const response = await api.post<Contact>('/api/contacts/', data)
    return response.data
  },
  update: async (id: number, data: Partial<Contact>): Promise<Contact> => {
    const response = await api.put<Contact>(`/api/contacts/${id}`, data)
    return response.data
  },
  get: async (id: number): Promise<Contact> => {
    const response = await api.get<Contact>(`/api/contacts/${id}`)
    return response.data
  },
}

export const statsAPI = {
  getToday: async (): Promise<Stats> => {
    const response = await api.get<Stats>('/api/stats/today')
    return response.data
  },
}

export const adminAPI = {
  listAgents: async (): Promise<Agent[]> => {
    const response = await api.get<Agent[]>('/api/admin/agents')
    return response.data
  },
  createAgent: async (agentData: {
    username: string
    phone_extension: string
    full_name?: string
    password: string
    is_admin?: number
  }): Promise<Agent> => {
    const response = await api.post<Agent>('/api/admin/agents', agentData)
    return response.data
  },
  updateAgent: async (agentId: number, agentData: {
    username?: string
    phone_extension?: string
    full_name?: string
    password?: string
    is_admin?: number
  }): Promise<Agent> => {
    const response = await api.put<Agent>(`/api/admin/agents/${agentId}`, agentData)
    return response.data
  },
  getAllAgentsStats: async (): Promise<AgentStats[]> => {
    const response = await api.get<AgentStats[]>('/api/admin/stats/all')
    return response.data
  },
  getSummaryStats: async (): Promise<AdminSummaryStats> => {
    const response = await api.get<AdminSummaryStats>('/api/admin/stats/summary')
    return response.data
  },
}

export default api
