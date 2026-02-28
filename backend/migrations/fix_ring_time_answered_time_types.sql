-- Fix ring_time and answered_time column types from INTEGER to TIMESTAMP
-- This migration fixes the schema mismatch in production

-- Check and fix ring_time column
DO $$
BEGIN
    -- Check if ring_time exists and is INTEGER type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' 
        AND column_name = 'ring_time' 
        AND data_type = 'integer'
    ) THEN
        -- Drop the old INTEGER column
        ALTER TABLE calls DROP COLUMN ring_time;
        -- Add new TIMESTAMP column
        ALTER TABLE calls ADD COLUMN ring_time TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Fixed ring_time column type from INTEGER to TIMESTAMP';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' 
        AND column_name = 'ring_time'
    ) THEN
        -- Column doesn't exist, create it
        ALTER TABLE calls ADD COLUMN ring_time TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Created ring_time column as TIMESTAMP';
    ELSE
        RAISE NOTICE 'ring_time column already exists with correct type';
    END IF;
END $$;

-- Check and fix answered_time column
DO $$
BEGIN
    -- Check if answered_time exists and is INTEGER type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' 
        AND column_name = 'answered_time' 
        AND data_type = 'integer'
    ) THEN
        -- Drop the old INTEGER column
        ALTER TABLE calls DROP COLUMN answered_time;
        -- Add new TIMESTAMP column
        ALTER TABLE calls ADD COLUMN answered_time TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Fixed answered_time column type from INTEGER to TIMESTAMP';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' 
        AND column_name = 'answered_time'
    ) THEN
        -- Column doesn't exist, create it
        ALTER TABLE calls ADD COLUMN answered_time TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Created answered_time column as TIMESTAMP';
    ELSE
        RAISE NOTICE 'answered_time column already exists with correct type';
    END IF;
END $$;

-- Ensure ring_duration and talk_duration exist as INTEGER
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS ring_duration INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS talk_duration INTEGER DEFAULT 0;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_calls_ring_time ON calls(ring_time);
CREATE INDEX IF NOT EXISTS idx_calls_answered_time ON calls(answered_time);
