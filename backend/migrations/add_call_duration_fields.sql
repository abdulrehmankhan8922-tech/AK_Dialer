-- Add ring_time, answered_time, ring_duration, and talk_duration columns to calls table
-- Run this on your database server

ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS ring_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS answered_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ring_duration INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS talk_duration INTEGER DEFAULT 0;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_calls_ring_time ON calls(ring_time);
CREATE INDEX IF NOT EXISTS idx_calls_answered_time ON calls(answered_time);
