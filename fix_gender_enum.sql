-- Fix gender_type_enum to include 'U' (Undefined) value
-- Run this SQL script on your PostgreSQL database

-- First, check what values the enum currently has:
-- SELECT unnest(enum_range(NULL::gender_type_enum));

-- Add 'U' value to the enum
-- Note: If 'U' already exists, this will give an error, which is safe to ignore
-- Run this command:
ALTER TYPE gender_type_enum ADD VALUE 'U';

-- Verify the enum now has all three values (M, F, U):
-- SELECT unnest(enum_range(NULL::gender_type_enum));
