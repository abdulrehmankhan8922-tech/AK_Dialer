-- =====================================================
-- Simple Fix: Add 'U' to gender_type_enum
-- =====================================================
-- NO NEED TO DROP OR RECREATE TABLES!
-- Just add the missing enum value.

-- Step 1: Check current enum values (optional - to see what you have)
SELECT unnest(enum_range(NULL::gender_type_enum)) AS current_values;

-- Step 2: Add 'U' to the enum (this is the only command you need)
-- If 'U' already exists, you'll get an error - that's fine, just ignore it
ALTER TYPE gender_type_enum ADD VALUE 'U';

-- Step 3: Verify it worked (optional - should show M, F, U)
SELECT unnest(enum_range(NULL::gender_type_enum)) AS updated_values;

-- That's it! No table changes needed.
-- Your contacts table will now accept 'U' for gender.
