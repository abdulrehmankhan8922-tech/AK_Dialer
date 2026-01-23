export interface Agent {
  id: number
  username: string
  phone_extension: string
  full_name?: string
  status: string
  is_admin: number
}

export interface Campaign {
  id: number
  name: string
  code: string
  description?: string
  status: string
  dial_method: string
}

export interface Contact {
  id: number
  campaign_id: number
  name?: string
  phone: string
  address?: string
  city?: string
  occupation?: string
  gender: 'M' | 'F' | 'U'
  whatsapp?: string
  email?: string
  comments?: string
  status: string
}

export interface Call {
  id: number
  agent_id?: number
  campaign_id?: number
  contact_id?: number
  phone_number: string
  direction: 'inbound' | 'outbound'
  status: string
  start_time: string
  end_time?: string
  duration: number
  call_unique_id?: string
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

export interface AgentSession {
  id: number
  agent_id: number
  campaign_id?: number
  session_id: string
  status: string
  login_time: string
  break_time: number
  login_duration: number
}
