-- =====================================================
-- Complete Database Setup Script for Dialer System
-- Date: 2024
-- Description: Creates all tables, indexes, and seed data
-- Usage: Run this file to create the entire database schema
-- =====================================================

-- Connect to PostgreSQL and create database first (if needed):
-- CREATE DATABASE dialer_db;
-- \c dialer_db

-- =====================================================
-- 1. CREATE TABLES
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_agents_username ON agents(username);
CREATE INDEX IF NOT EXISTS idx_agents_phone_extension ON agents(phone_extension);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(255) UNIQUE NOT NULL,
    description VARCHAR(500),
    status VARCHAR(50) DEFAULT 'active',
    dial_method VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_campaigns_name ON campaigns(name);
CREATE INDEX IF NOT EXISTS idx_campaigns_code ON campaigns(code);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    name VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    address VARCHAR(500),
    city VARCHAR(100),
    occupation VARCHAR(100),
    gender VARCHAR(1) DEFAULT 'U',
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    comments TEXT,
    status VARCHAR(50) DEFAULT 'new',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_contacts_campaign_id ON contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);

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
    login_duration INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_campaign_id ON agent_sessions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_id ON agent_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_logout_time ON agent_sessions(logout_time);

-- Calls Table (with all fields including Phase 1 and Phase 2)
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
-- 2. SEED DATA (Optional - Comment out if not needed)
-- =====================================================

-- Insert Sample Campaigns
INSERT INTO campaigns (name, code, description, status, dial_method)
VALUES 
    ('Test Campaign 1', 'TC001', 'First test campaign', 'active', 'manual'),
    ('J7G Campaign 4', 'J7GC4', 'J7G Campaign 4', 'active', 'manual')
ON CONFLICT (code) DO NOTHING;

-- Insert Admin User (password: admin)
-- Password hash for 'admin' using bcrypt
INSERT INTO agents (username, password_hash, full_name, phone_extension, status, is_admin)
VALUES 
    ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5LS2V5Q5q5Q5m', 'Administrator', 'admin', 'logged_out', 1)
ON CONFLICT (username) DO NOTHING;

-- Insert Sample Agents (password: password)
-- Password hash for 'password' using bcrypt
INSERT INTO agents (username, password_hash, full_name, phone_extension, status, is_admin)
VALUES 
    ('8013', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Agent 8013', '8013', 'logged_out', 0),
    ('8014', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Agent 8014', '8014', 'logged_out', 0)
ON CONFLICT (username) DO NOTHING;

-- Insert Sample Contacts (requires campaigns to exist first)
INSERT INTO contacts (campaign_id, name, phone, address, city, occupation, gender, whatsapp, email, comments, status)
SELECT 
    1, 'Ahmed Ali', '03001234567', '123 Main St', 'Karachi', 'Engineer', 'M', '03001234567', 'ahmed@example.com', 'Sample contact', 'new'
WHERE EXISTS (SELECT 1 FROM campaigns WHERE id = 1)
ON CONFLICT DO NOTHING;

INSERT INTO contacts (campaign_id, name, phone, address, city, occupation, gender, whatsapp, email, comments, status)
SELECT 
    1, 'Fatima Khan', '03001234568', '456 Park Ave', 'Lahore', 'Teacher', 'F', '03001234568', 'fatima@example.com', 'Sample contact', 'new'
WHERE EXISTS (SELECT 1 FROM campaigns WHERE id = 1)
ON CONFLICT DO NOTHING;

INSERT INTO contacts (campaign_id, name, phone, address, city, occupation, gender, whatsapp, email, comments, status)
SELECT 
    2, 'Muhammad Hassan', '03001234569', '789 Market St', 'Islamabad', 'Doctor', 'M', '03001234569', 'hassan@example.com', 'Sample contact', 'new'
WHERE EXISTS (SELECT 1 FROM campaigns WHERE id = 2)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. VERIFY INSTALLATION
-- =====================================================

-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Count records in each table
SELECT 
    'agents' as table_name, COUNT(*) as record_count FROM agents
UNION ALL
SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'agent_sessions', COUNT(*) FROM agent_sessions
UNION ALL
SELECT 'calls', COUNT(*) FROM calls
UNION ALL
SELECT 'call_recordings', COUNT(*) FROM call_recordings
UNION ALL
SELECT 'call_quality_metrics', COUNT(*) FROM call_quality_metrics;

-- =====================================================
-- NOTES:
-- =====================================================
-- - All tables use IF NOT EXISTS to prevent errors on re-run
-- - Foreign key constraints ensure referential integrity
-- - Indexes are created for performance on frequently queried columns
-- - Seed data uses ON CONFLICT DO NOTHING to allow re-runs
-- - Password hashes are bcrypt hashed passwords (default: admin/admin, password/password)
-- - To change passwords, generate new hashes using: 
--   python -c "from passlib.context import CryptContext; pwd = CryptContext(schemes=['bcrypt'], deprecated='auto'); print(pwd.hash('your_password'))"
-- =====================================================
