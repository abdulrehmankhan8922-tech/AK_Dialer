-- =====================================================
-- Complete Database Setup Script for Dialer System
-- Date: 2025
-- Description: Complete database schema with all tables, enums, views, and functions
-- Usage: Run this file to create the entire database from scratch
-- =====================================================

-- Connect to PostgreSQL and create database first (if needed):
-- CREATE DATABASE dialer_db;
-- \c dialer_db

-- =====================================================
-- 1. CREATE ENUM TYPES
-- =====================================================

-- Gender Type Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type_enum') THEN
        CREATE TYPE gender_type_enum AS ENUM ('M', 'F', 'U');
    END IF;
END $$;

-- Contact Status Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_status_enum') THEN
        CREATE TYPE contact_status_enum AS ENUM ('new', 'contacted', 'not_answered', 'busy', 'failed', 'do_not_call');
    END IF;
END $$;

-- =====================================================
-- 2. CREATE CORE TABLES
-- =====================================================

-- Agents Table
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone_extension VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'logged_out',
    is_admin INTEGER DEFAULT 0,
    email VARCHAR(255),
    phone VARCHAR(50),
    department VARCHAR(100),
    supervisor_id INTEGER REFERENCES agents(id),
    max_concurrent_calls INTEGER DEFAULT 1,
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    last_login TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_agents_username ON agents(username);
CREATE INDEX IF NOT EXISTS idx_agents_phone_extension ON agents(phone_extension);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_supervisor_id ON agents(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_agents_last_login ON agents(last_login);

-- Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(255) UNIQUE NOT NULL,
    description VARCHAR(500),
    status VARCHAR(50) DEFAULT 'active',
    dial_method VARCHAR(50) DEFAULT 'manual',
    start_date DATE,
    end_date DATE,
    max_daily_calls INTEGER,
    max_concurrent_calls INTEGER DEFAULT 10,
    retry_attempts INTEGER DEFAULT 3,
    retry_delay INTEGER DEFAULT 3600,
    timezone VARCHAR(50) DEFAULT 'UTC',
    business_hours_start TIME DEFAULT '09:00:00',
    business_hours_end TIME DEFAULT '17:00:00',
    business_days VARCHAR(20) DEFAULT 'mon-fri',
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_campaigns_name ON campaigns(name);
CREATE INDEX IF NOT EXISTS idx_campaigns_code ON campaigns(code);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON campaigns(start_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_end_date ON campaigns(end_date);

-- Contacts Table (with enum types)
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    name VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    address VARCHAR(500),
    city VARCHAR(100),
    occupation VARCHAR(100),
    gender gender_type_enum DEFAULT 'U'::gender_type_enum,
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    comments TEXT,
    status contact_status_enum DEFAULT 'new'::contact_status_enum,
    country_code VARCHAR(10) DEFAULT '+92',
    alternate_phone VARCHAR(50),
    date_of_birth DATE,
    cnic VARCHAR(20),
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50),
    last_contacted TIMESTAMP WITH TIME ZONE,
    contact_count INTEGER DEFAULT 0,
    tags TEXT[],
    custom_fields JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_contacts_campaign_id ON contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_last_contacted ON contacts(last_contacted);
CREATE INDEX IF NOT EXISTS idx_contacts_cnic ON contacts(cnic);

-- Agent Sessions Table
CREATE TABLE IF NOT EXISTS agent_sessions (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES agents(id),
    campaign_id INTEGER REFERENCES campaigns(id),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'available',
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP WITH TIME ZONE,
    break_time INTEGER DEFAULT 0,
    login_duration INTEGER DEFAULT 0,
    ip_address VARCHAR(50),
    user_agent TEXT,
    total_calls INTEGER DEFAULT 0,
    answered_calls INTEGER DEFAULT 0,
    total_talk_time INTEGER DEFAULT 0,
    total_break_time INTEGER DEFAULT 0,
    total_idle_time INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_campaign_id ON agent_sessions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_id ON agent_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_logout_time ON agent_sessions(logout_time);

-- Calls Table
CREATE TABLE IF NOT EXISTS calls (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id),
    campaign_id INTEGER REFERENCES campaigns(id),
    contact_id INTEGER REFERENCES contacts(id),
    phone_number VARCHAR(50) NOT NULL,
    direction VARCHAR(50) DEFAULT 'outbound',
    status VARCHAR(50) DEFAULT 'dialing',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER DEFAULT 0,
    recording_path VARCHAR(500),
    call_unique_id VARCHAR(255) UNIQUE,
    freeswitch_channel VARCHAR(255),
    agent_channel VARCHAR(255),
    customer_channel VARCHAR(255),
    bridge_unique_id VARCHAR(255),
    is_muted BOOLEAN DEFAULT FALSE,
    is_on_hold BOOLEAN DEFAULT FALSE,
    billsec INTEGER DEFAULT 0,
    disposition VARCHAR(50),
    notes TEXT,
    caller_id_name VARCHAR(255),
    caller_id_number VARCHAR(50),
    hangup_cause VARCHAR(100),
    hangup_reason TEXT,
    cost DECIMAL(10, 4),
    currency VARCHAR(10) DEFAULT 'PKR',
    answered_by VARCHAR(50),
    transfer_from_agent_id INTEGER REFERENCES agents(id),
    transfer_to_agent_id INTEGER REFERENCES agents(id),
    queue_id INTEGER REFERENCES call_queues(id),
    wait_time INTEGER DEFAULT 0,
    ring_time INTEGER DEFAULT 0,
    hold_time INTEGER DEFAULT 0,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calls_agent_id ON calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_campaign_id ON calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_phone_number ON calls(phone_number);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_call_unique_id ON calls(call_unique_id);
CREATE INDEX IF NOT EXISTS idx_calls_agent_channel ON calls(agent_channel);
CREATE INDEX IF NOT EXISTS idx_calls_customer_channel ON calls(customer_channel);
CREATE INDEX IF NOT EXISTS idx_calls_bridge_unique_id ON calls(bridge_unique_id);
CREATE INDEX IF NOT EXISTS idx_calls_start_time ON calls(start_time);
CREATE INDEX IF NOT EXISTS idx_calls_hangup_cause ON calls(hangup_cause);
CREATE INDEX IF NOT EXISTS idx_calls_transfer_from_agent_id ON calls(transfer_from_agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_transfer_to_agent_id ON calls(transfer_to_agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_queue_id ON calls(queue_id);

-- Call Recordings Table
CREATE TABLE IF NOT EXISTS call_recordings (
    id SERIAL PRIMARY KEY,
    call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    duration INTEGER,
    format VARCHAR(20) DEFAULT 'wav',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_recordings_call_id ON call_recordings(call_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_created_at ON call_recordings(created_at);

-- Call Quality Metrics Table
CREATE TABLE IF NOT EXISTS call_quality_metrics (
    id SERIAL PRIMARY KEY,
    call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    jitter FLOAT,
    packet_loss FLOAT,
    mos_score FLOAT,
    rtt FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_quality_metrics_call_id ON call_quality_metrics(call_id);

-- =====================================================
-- 3. CREATE ENHANCEMENT TABLES
-- =====================================================

-- DNC (Do Not Call) List Table
CREATE TABLE IF NOT EXISTS dnc_list (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    reason VARCHAR(255),
    source VARCHAR(100) DEFAULT 'manual',
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
    note_type VARCHAR(50) DEFAULT 'general',
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

-- Agent Performance Metrics Table
CREATE TABLE IF NOT EXISTS agent_performance (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    period_type VARCHAR(20) DEFAULT 'daily',
    total_calls INTEGER DEFAULT 0,
    answered_calls INTEGER DEFAULT 0,
    missed_calls INTEGER DEFAULT 0,
    total_talk_time INTEGER DEFAULT 0,
    avg_call_duration INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    conversion_rate FLOAT DEFAULT 0.0,
    total_break_time INTEGER DEFAULT 0,
    login_duration INTEGER DEFAULT 0,
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
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
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
    condition_type VARCHAR(50) NOT NULL,
    condition_value TEXT NOT NULL,
    target_type VARCHAR(50) NOT NULL,
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
    duration INTEGER,
    transcription TEXT,
    is_listened BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voicemail_messages_call_id ON voicemail_messages(call_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_agent_id ON voicemail_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_is_listened ON voicemail_messages(is_listened);

-- Campaign Statistics Table
CREATE TABLE IF NOT EXISTS campaign_statistics (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_calls INTEGER DEFAULT 0,
    answered_calls INTEGER DEFAULT 0,
    missed_calls INTEGER DEFAULT 0,
    total_talk_time INTEGER DEFAULT 0,
    total_contacts_processed INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    conversion_rate FLOAT DEFAULT 0.0,
    avg_call_duration INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_statistics_campaign_id ON campaign_statistics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_statistics_date ON campaign_statistics(date);

-- SIP Trunk Configuration Table
CREATE TABLE IF NOT EXISTS sip_trunk_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    provider VARCHAR(100),
    server VARCHAR(255) NOT NULL,
    port INTEGER DEFAULT 5060,
    username VARCHAR(255),
    password VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sip_trunk_config_is_active ON sip_trunk_config(is_active);
CREATE INDEX IF NOT EXISTS idx_sip_trunk_config_is_default ON sip_trunk_config(is_default);

-- Call Queue Table
CREATE TABLE IF NOT EXISTS call_queues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    strategy VARCHAR(50) DEFAULT 'ringall',
    timeout INTEGER DEFAULT 20,
    max_wait_time INTEGER DEFAULT 300,
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
-- 4. INSERT SEED DATA
-- =====================================================

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

-- Insert Sample Campaigns
INSERT INTO campaigns (name, code, description, status, dial_method)
VALUES 
    ('Test Campaign 1', 'TC001', 'First test campaign', 'active', 'manual'),
    ('J7G Campaign 4', 'J7GC4', 'J7G Campaign 4', 'active', 'manual')
ON CONFLICT (code) DO NOTHING;

-- Insert Admin User (password: admin)
INSERT INTO agents (username, password_hash, full_name, phone_extension, status, is_admin)
VALUES 
    ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5LS2V5Q5q5Q5m', 'Administrator', 'admin', 'logged_out', 1)
ON CONFLICT (username) DO NOTHING;

-- Insert Sample Agents (password: password)
INSERT INTO agents (username, password_hash, full_name, phone_extension, status, is_admin)
VALUES 
    ('8013', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Agent 8013', '8013', 'logged_out', 0),
    ('8014', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Agent 8014', '8014', 'logged_out', 0)
ON CONFLICT (username) DO NOTHING;

-- Insert Sample Contacts (requires campaigns to exist first)
INSERT INTO contacts (campaign_id, name, phone, address, city, occupation, gender, whatsapp, email, comments, status)
SELECT 
    1, 'Ahmed Ali', '03001234567', '123 Main St', 'Karachi', 'Engineer', 'M'::gender_type_enum, '03001234567', 'ahmed@example.com', 'Sample contact', 'new'::contact_status_enum
WHERE EXISTS (SELECT 1 FROM campaigns WHERE id = 1)
ON CONFLICT DO NOTHING;

INSERT INTO contacts (campaign_id, name, phone, address, city, occupation, gender, whatsapp, email, comments, status)
SELECT 
    1, 'Fatima Khan', '03001234568', '456 Park Ave', 'Lahore', 'Teacher', 'F'::gender_type_enum, '03001234568', 'fatima@example.com', 'Sample contact', 'new'::contact_status_enum
WHERE EXISTS (SELECT 1 FROM campaigns WHERE id = 1)
ON CONFLICT DO NOTHING;

INSERT INTO contacts (campaign_id, name, phone, address, city, occupation, gender, whatsapp, email, comments, status)
SELECT 
    2, 'Muhammad Hassan', '03001234569', '789 Market St', 'Islamabad', 'Doctor', 'M'::gender_type_enum, '03001234569', 'hassan@example.com', 'Sample contact', 'new'::contact_status_enum
WHERE EXISTS (SELECT 1 FROM campaigns WHERE id = 2)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. CREATE VIEWS
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
    COUNT(DISTINCT CASE WHEN ct.status::text = 'contacted' THEN ct.id END) as contacted_contacts,
    AVG(cl.duration) as avg_call_duration
FROM campaigns c
LEFT JOIN contacts ct ON c.id = ct.campaign_id
LEFT JOIN calls cl ON c.id = cl.campaign_id
GROUP BY c.id, c.name, c.code;

-- =====================================================
-- 6. CREATE FUNCTIONS
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
-- 7. ADD COMMENTS (Documentation)
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
-- END OF COMPLETE DATABASE SETUP
-- =====================================================

-- Verify installation
SELECT 'Database setup completed successfully!' as status;

-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
