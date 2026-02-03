# Database Enhancements Guide

## Overview

This document describes the additional database tables and columns added to enhance the dialer system functionality.

## New Tables

### 1. `dnc_list` - Do Not Call List
**Purpose:** Store phone numbers that should not be called

**Key Fields:**
- `phone_number` - The blocked number
- `reason` - Why it's blocked
- `source` - How it was added (manual, customer_request, system, import)
- `added_by` - Agent who added it

**Usage:**
```sql
-- Check if number is in DNC
SELECT is_dnc('03001234567');

-- Add to DNC
INSERT INTO dnc_list (phone_number, reason, source) 
VALUES ('03001234567', 'Customer requested', 'customer_request');
```

### 2. `call_notes` - Call Notes and Transcripts
**Purpose:** Store notes, transcripts, and follow-up information for calls

**Key Fields:**
- `call_id` - Related call
- `note_type` - Type of note (general, transcript, follow_up, complaint)
- `content` - Note content
- `is_important` - Flag for important notes

### 3. `disposition_categories` - Call Disposition Categories
**Purpose:** Predefined categories for call outcomes

**Default Categories:**
- Sale
- Not Interested
- Call Back
- No Answer
- Busy
- Wrong Number
- Do Not Call
- Follow Up Required
- Completed
- Failed

### 4. `agent_performance` - Agent Performance Metrics
**Purpose:** Daily/Weekly/Monthly aggregated performance data

**Key Metrics:**
- Total calls, answered calls, missed calls
- Total talk time, average call duration
- Total sales, conversion rate
- Break time, login duration

### 5. `audit_log` - System Audit Trail
**Purpose:** Track all important system actions

**Tracks:**
- User logins/logouts
- Agent creation/updates
- Configuration changes
- System events

### 6. `call_routing_rules` - Call Routing Rules
**Purpose:** Define rules for routing incoming calls

**Rule Types:**
- Phone prefix routing
- Campaign-based routing
- Time-based routing
- Day-of-week routing

### 7. `voicemail_messages` - Voicemail Storage
**Purpose:** Store voicemail messages

**Fields:**
- Caller information
- Audio file path
- Transcription
- Listen status

### 8. `campaign_statistics` - Campaign Statistics
**Purpose:** Daily aggregated campaign performance

**Metrics:**
- Total calls, answered calls
- Talk time, conversion rate
- Contacts processed

### 9. `sip_trunk_config` - SIP Trunk Configuration
**Purpose:** Store SIP trunk settings in database

**Fields:**
- Provider information
- Server, port, credentials
- Active/default status

### 10. `call_queues` & `call_queue_members` - Call Queues
**Purpose:** Manage call queues and queue members

**Features:**
- Queue strategies (ringall, rrmemory, etc.)
- Agent priorities and penalties
- Timeout settings

## New Columns Added to Existing Tables

### Agents Table
- `email` - Agent email address
- `phone` - Agent phone number
- `department` - Department assignment
- `supervisor_id` - Reporting supervisor
- `max_concurrent_calls` - Max simultaneous calls
- `timezone` - Agent timezone
- `language` - Preferred language
- `last_login` - Last login timestamp
- `last_activity` - Last activity timestamp

### Campaigns Table
- `start_date` / `end_date` - Campaign dates
- `max_daily_calls` - Daily call limit
- `max_concurrent_calls` - Concurrent call limit
- `retry_attempts` / `retry_delay` - Retry settings
- `business_hours_start` / `business_hours_end` - Business hours
- `business_days` - Active days
- `settings` - JSON field for additional settings

### Contacts Table
- `country_code` - Country code (+92 for Pakistan)
- `alternate_phone` - Alternate contact number
- `date_of_birth` - DOB
- `cnic` - CNIC number (Pakistan)
- `preferred_language` - Language preference
- `timezone` - Contact timezone
- `last_contacted` - Last contact timestamp
- `contact_count` - Number of times contacted
- `tags` - Array of tags
- `custom_fields` - JSON for custom data

### Calls Table
- `caller_id_name` / `caller_id_number` - Caller ID info
- `hangup_cause` / `hangup_reason` - Hangup details
- `cost` / `currency` - Call cost
- `answered_by` - Who answered (agent, ivr, voicemail)
- `transfer_from_agent_id` / `transfer_to_agent_id` - Transfer info
- `queue_id` - Queue assignment
- `wait_time` / `ring_time` / `hold_time` - Timing metrics
- `tags` - Array of tags

### Agent Sessions Table
- `ip_address` - Login IP
- `user_agent` - Browser/client info
- `total_calls` - Calls in session
- `answered_calls` - Answered calls
- `total_talk_time` - Total talk time
- `total_break_time` - Total break time
- `total_idle_time` - Total idle time

## Useful Views

### `v_active_agents`
Shows currently active agents with their session stats

### `v_daily_call_stats`
Daily aggregated call statistics for the last 30 days

### `v_campaign_performance`
Campaign performance overview with key metrics

## Useful Functions

### `is_dnc(phone_num)`
Check if a phone number is in the DNC list

### `get_agent_session_stats(agent_id)`
Get current session statistics for an agent

## Installation

Run the SQL file on your PostgreSQL database:

```bash
psql -U your_user -d dialer_db -f database_enhancements.sql
```

Or from psql:
```sql
\i database_enhancements.sql
```

## Benefits

1. **DNC Management** - Prevent calling blocked numbers
2. **Better Analytics** - Detailed performance metrics
3. **Audit Trail** - Track all system changes
4. **Call Routing** - Flexible call routing rules
5. **Voicemail** - Store and manage voicemails
6. **Campaign Tracking** - Detailed campaign statistics
7. **Queue Management** - Advanced call queue features
8. **Custom Fields** - JSON fields for flexibility
9. **Better Reporting** - Pre-built views for common queries

## Notes

- All new tables include proper indexes for performance
- Foreign key constraints ensure data integrity
- Timestamps are timezone-aware
- JSON fields allow flexible data storage
- Views provide easy access to aggregated data
