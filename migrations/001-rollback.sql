-- ============================================
-- Rollback Migration: Revert Schema Changes
-- Date: 2026-01-30
-- Description: Rollback to previous schema
-- ============================================

BEGIN;

-- 1. Restore Users Table
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(500);

-- 2. Restore Farms Table
ALTER TABLE farms ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Remove new location fields
ALTER TABLE farms DROP COLUMN IF EXISTS sector;
ALTER TABLE farms DROP COLUMN IF EXISTS cell;
ALTER TABLE farms DROP COLUMN IF EXISTS village;

-- Make ownerPhone required again
ALTER TABLE farms ALTER COLUMN "ownerPhone" SET NOT NULL;

-- 3. Restore single farm per user constraint
ALTER TABLE farms ADD CONSTRAINT "UQ_farms_userId" UNIQUE ("userId");

COMMIT;

\echo '✅ Rollback completed successfully'
