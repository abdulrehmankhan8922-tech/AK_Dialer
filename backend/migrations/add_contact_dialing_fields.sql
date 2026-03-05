-- Add last_dialed_at and dial_attempts columns to contacts table
-- Run this on your database server

ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS last_dialed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS dial_attempts INTEGER DEFAULT 0;

-- Add index for better query performance on dialed contacts
CREATE INDEX IF NOT EXISTS idx_contacts_last_dialed_at ON contacts(last_dialed_at);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
