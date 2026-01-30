-- ============================================
-- Migration: Add Missing Columns
-- Date: 2026-01-30
-- Description: Add profileImage and phoneNumber to users
-- ============================================

-- Add profileImage column to users if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS "profileImage" VARCHAR(500);

-- Add phoneNumber column to users if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS "phoneNumber" VARCHAR(50);

-- Verify columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('profileImage', 'phoneNumber');
