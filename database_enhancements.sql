-- =====================================================
-- Database Enhancements for Dialer System
-- Date: 2025
-- Description: Additional tables and columns for enhanced functionality
-- Usage: Run this file to add new features to existing database
-- =====================================================

-- =====================================================
-- 1. NEW TABLES
-- =====================================================

-- DNC (Do Not Call) List Table
CREATE TABLE IF NOT EXISTS dnc_list (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    reason VARCHAR(255),
    source VARCHAR(100) DEFAULT 'manual', -- 'manual', 'customer_request', 'system', 'import'
    added_by INTEGER REFERENCES agents(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_dnc_phone_number ON dnc_list(phone_number);
CREATE INDEX IF NOT EXISTS idx_dnc_created_at ON dnc_list(created_at);

-- Call Notes/Transcripts Table
CREATE TABLE IF NOT EXISTS call_notes (
    id SERIAL PRIMARY KEY,
    call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agents(id),
    note_type VARCHAR(50) DEFAULT 'general', -- 'general', 'transcript', 'follow_up', 'complaint'
    content TEXT NOT NULL,
    is_important BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_call_notes_call_id ON call_notes(call_id);
CREATE INDEX IF NOT EXISTS idx_call_notes_agent_id ON call_notes(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_notes_created_at ON call_notes(created_at);

-- Call Disposition Categories Table
CREATE TABLE IF NOT EXISTS disposition_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default disposition categories
INSERT INTO disposition_categories (name, code, description, sort_order) VALUES
    ('Sale', 'SALE', 'Customer made a purchase', 1),
    ('Not Interested', 'NOT_INTERESTED', 'Customer not interested', 2),
    ('Call Back', 'CALLBACK', 'Customer requested callback', 3),
    ('No Answer', 'NO_ANSWER', 'Customer did not answer', 4),
    ('Busy', 'BUSY', 'Customer line was busy', 5),
    ('Wrong Number', 'WRONG_NUMBER', 'Wrong number reached', 6),
    ('Do Not Call', 'DNC', 'Customer requested to be removed', 7),
    ('Follow Up Required', 'FOLLOW_UP', 'Follow up needed', 8),
    ('Completed', 'COMPLETED', 'Call completed successfully', 9),
    ('Failed', 'FAILED', 'Call failed', 10)
ON CONFLICT (code) DO NOTHING;

-- Agent Performance Metrics Table (Daily/Weekly/Monthly aggregates)
CREATE TABLE IF NOT EXISTS agent_performance (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    period_type VARCHAR(20) DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
    total_calls INTEGER DEFAULT 0,
    answered_calls INTEGER DEFAULT 0,
    missed_calls INTEGER DEFAULT 0,
    total_talk_time INTEGER DEFAULT 0, -- seconds
    avg_call_duration INTEGER DEFAULT 0, -- seconds
    total_sales INTEGER DEFAULT 0,
    conversion_rate FLOAT DEFAULT 0.0,
    total_break_time INTEGER DEFAULT 0, -- seconds
    login_duration INTEGER DEFAULT 0, -- seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(agent_id, date, period_type)
);

CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_id ON agent_performance(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_date ON agent_performance(date);
CREATE INDEX IF NOT EXISTS idx_agent_performance_period_type ON agent_performance(period_type);

-- System Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES agents(id),
    action VARCHAR(100) NOT NULL, -- 'login', 'logout', 'create_agent', 'update_config', etc.
    entity_type VARCHAR(50), -- 'agent', 'campaign', 'contact', 'call', 'system'
    entity_id INTEGER,
    details JSONB, -- Store additional details as JSON
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Call Routing Rules Table
CREATE TABLE IF NOT EXISTS call_routing_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    priority INTEGER DEFAULT 0,
    condition_type VARCHAR(50) NOT NULL, -- 'phone_prefix', 'campaign', 'time_of_day', 'day_of_week'
    condition_value TEXT NOT NULL,
    target_type VARCHAR(50) NOT NULL, -- 'agent', 'queue', 'voicemail', 'ivr'
    target_value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_call_routing_rules_priority ON call_routing_rules(priority);
CREATE INDEX IF NOT EXISTS idx_call_routing_rules_is_active ON call_routing_rules(is_active);

-- Voicemail Messages Table
CREATE TABLE IF NOT EXISTS voicemail_messages (
    id SERIAL PRIMARY KEY,
    call_id INTEGER REFERENCES calls(id),
    agent_id INTEGER REFERENCES agents(id),
    caller_number VARCHAR(50),
    caller_name VARCHAR(255),
    file_path VARCHAR(500) NOT NULL,
    duration INTEGER, -- seconds
    transcription TEXT,
    is_listened BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voicemail_messages_call_id ON voicemail_messages(call_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_agent_id ON voicemail_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_is_listened ON voicemail_messages(is_listened);

-- Campaign Statistics Table (Daily aggregates)
CREATE TABLE IF NOT EXISTS campaign_statistics (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_calls INTEGER DEFAULT 0,
    answered_calls INTEGER DEFAULT 0,
    missed_calls INTEGER DEFAULT 0,
    total_talk_time INTEGER DEFAULT 0, -- seconds
    total_contacts_processed INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    conversion_rate FLOAT DEFAULT 0.0,
    avg_call_duration INTEGER DEFAULT 0, -- seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_statistics_campaign_id ON campaign_statistics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_statistics_date ON campaign_statistics(date);

-- SIP Trunk Configuration Table (for storing trunk settings in DB)
CREATE TABLE IF NOT EXISTS sip_trunk_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    provider VARCHAR(100),
    server VARCHAR(255) NOT NULL,
    port INTEGER DEFAULT 5060,
    username VARCHAR(255),
    password VARCHAR(255), -- Should be encrypted in production
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    settings JSONB, -- Additional settings as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sip_trunk_config_is_active ON sip_trunk_config(is_active);
CREATE INDEX IF NOT EXISTS idx_sip_trunk_config_is_default ON sip_trunk_config(is_default);

-- Call Queue Table (for managing call queues)
CREATE TABLE IF NOT EXISTS call_queues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    strategy VARCHAR(50) DEFAULT 'ringall', -- 'ringall', 'rrmemory', 'leastrecent', etc.
    timeout INTEGER DEFAULT 20, -- seconds
    max_wait_time INTEGER DEFAULT 300, -- seconds
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Call Queue Members Table
CREATE TABLE IF NOT EXISTS call_queue_members (
    id SERIAL PRIMARY KEY,
    queue_id INTEGER NOT NULL REFERENCES call_queues(id) ON DELETE CASCADE,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,
    penalty INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(queue_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_call_queue_members_queue_id ON call_queue_members(queue_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_members_agent_id ON call_queue_members(agent_id);

-- =====================================================
-- 2. ADD COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add columns to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS supervisor_id INTEGER REFERENCES agents(id),
ADD COLUMN IF NOT EXISTS max_concurrent_calls INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_agents_supervisor_id ON agents(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_agents_last_login ON agents(last_login);

-- Add columns to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS max_daily_calls INTEGER,
ADD COLUMN IF NOT EXISTS max_concurrent_calls INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS retry_attempts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS retry_delay INTEGER DEFAULT 3600, -- seconds
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS business_hours_start TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS business_hours_end TIME DEFAULT '17:00:00',
ADD COLUMN IF NOT EXISTS business_days VARCHAR(20) DEFAULT 'mon-fri', -- 'mon-fri', 'mon-sat', 'all'
ADD COLUMN IF NOT EXISTS settings JSONB; -- Additional campaign settings

CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON campaigns(start_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_end_date ON campaigns(end_date);

-- Add columns to contacts table
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) DEFAULT '+92',
ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS cnic VARCHAR(20), -- CNIC for Pakistan
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_contacted TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS contact_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tags TEXT[], -- Array of tags
ADD COLUMN IF NOT EXISTS custom_fields JSONB; -- Additional custom fields as JSON

CREATE INDEX IF NOT EXISTS idx_contacts_last_contacted ON contacts(last_contacted);
CREATE INDEX IF NOT EXISTS idx_contacts_cnic ON contacts(cnic);

-- Add columns to calls table
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS caller_id_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS caller_id_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS hangup_cause VARCHAR(100),
ADD COLUMN IF NOT EXISTS hangup_reason TEXT,
ADD COLUMN IF NOT EXISTS cost DECIMAL(10, 4), -- Call cost
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'PKR',
ADD COLUMN IF NOT EXISTS answered_by VARCHAR(50), -- 'agent', 'ivr', 'voicemail'
ADD COLUMN IF NOT EXISTS transfer_from_agent_id INTEGER REFERENCES agents(id),
ADD COLUMN IF NOT EXISTS transfer_to_agent_id INTEGER REFERENCES agents(id),
ADD COLUMN IF NOT EXISTS queue_id INTEGER REFERENCES call_queues(id),
ADD COLUMN IF NOT EXISTS wait_time INTEGER DEFAULT 0, -- seconds before answer
ADD COLUMN IF NOT EXISTS ring_time INTEGER DEFAULT 0, -- seconds ringing
ADD COLUMN IF NOT EXISTS hold_time INTEGER DEFAULT 0, -- total hold time in seconds
ADD COLUMN IF NOT EXISTS tags TEXT[]; -- Array of tags

CREATE INDEX IF NOT EXISTS idx_calls_hangup_cause ON calls(hangup_cause);
CREATE INDEX IF NOT EXISTS idx_calls_transfer_from_agent_id ON calls(transfer_from_agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_transfer_to_agent_id ON calls(transfer_to_agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_queue_id ON calls(queue_id);

-- Add columns to agent_sessions table
ALTER TABLE agent_sessions
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50),
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS total_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS answered_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_talk_time INTEGER DEFAULT 0, -- seconds
ADD COLUMN IF NOT EXISTS total_break_time INTEGER DEFAULT 0, -- seconds
ADD COLUMN IF NOT EXISTS total_idle_time INTEGER DEFAULT 0; -- seconds

-- =====================================================
-- 3. USEFUL VIEWS
-- =====================================================

-- View: Active Agents Summary
CREATE OR REPLACE VIEW v_active_agents AS
SELECT 
    a.id,
    a.username,
    a.full_name,
    a.phone_extension,
    a.status,
    s.login_time,
    s.total_calls,
    s.answered_calls,
    s.total_talk_time
FROM agents a
LEFT JOIN agent_sessions s ON a.id = s.agent_id AND s.logout_time IS NULL
WHERE a.status != 'logged_out';

-- View: Daily Call Statistics
CREATE OR REPLACE VIEW v_daily_call_stats AS
SELECT 
    DATE(start_time) as call_date,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN status = 'answered' THEN 1 END) as answered_calls,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
    AVG(duration) as avg_duration,
    SUM(duration) as total_duration,
    COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound_calls,
    COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound_calls
FROM calls
WHERE start_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(start_time)
ORDER BY call_date DESC;

-- View: Campaign Performance
CREATE OR REPLACE VIEW v_campaign_performance AS
SELECT 
    c.id,
    c.name,
    c.code,
    COUNT(DISTINCT ct.id) as total_contacts,
    COUNT(DISTINCT cl.id) as total_calls,
    COUNT(DISTINCT CASE WHEN cl.status = 'answered' THEN cl.id END) as answered_calls,
    COUNT(DISTINCT CASE WHEN ct.status = 'contacted' THEN ct.id END) as contacted_contacts,
    AVG(cl.duration) as avg_call_duration
FROM campaigns c
LEFT JOIN contacts ct ON c.id = ct.campaign_id
LEFT JOIN calls cl ON c.id = cl.campaign_id
GROUP BY c.id, c.name, c.code;

-- =====================================================
-- 4. USEFUL FUNCTIONS
-- =====================================================

-- Function: Check if number is in DNC list
CREATE OR REPLACE FUNCTION is_dnc(phone_num VARCHAR) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM dnc_list WHERE phone_number = phone_num);
END;
$$ LANGUAGE plpgsql;

-- Function: Get agent's current session stats
CREATE OR REPLACE FUNCTION get_agent_session_stats(agent_id_param INTEGER)
RETURNS TABLE (
    total_calls BIGINT,
    answered_calls BIGINT,
    total_talk_time BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT,
        COUNT(CASE WHEN c.status = 'answered' THEN 1 END)::BIGINT,
        COALESCE(SUM(c.duration), 0)::BIGINT
    FROM calls c
    WHERE c.agent_id = agent_id_param
    AND c.start_time >= (
        SELECT login_time 
        FROM agent_sessions 
        WHERE agent_id = agent_id_param 
        AND logout_time IS NULL 
        ORDER BY login_time DESC 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE dnc_list IS 'Do Not Call list to prevent calling blocked numbers';
COMMENT ON TABLE call_notes IS 'Notes and transcripts for calls';
COMMENT ON TABLE disposition_categories IS 'Predefined call disposition categories';
COMMENT ON TABLE agent_performance IS 'Aggregated performance metrics for agents';
COMMENT ON TABLE audit_log IS 'System audit trail for all important actions';
COMMENT ON TABLE call_routing_rules IS 'Rules for routing incoming calls';
COMMENT ON TABLE voicemail_messages IS 'Voicemail messages from calls';
COMMENT ON TABLE campaign_statistics IS 'Daily aggregated statistics for campaigns';
COMMENT ON TABLE sip_trunk_config IS 'SIP trunk configurations stored in database';
COMMENT ON TABLE call_queues IS 'Call queue definitions';
COMMENT ON TABLE call_queue_members IS 'Agents assigned to call queues';

-- =====================================================
-- END OF ENHANCEMENTS
-- =====================================================
