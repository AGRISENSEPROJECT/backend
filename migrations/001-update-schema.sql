-- ============================================
-- Migration: Update Schema for Multiple Farms
-- Date: 2026-01-30
-- Description: 
--   - Remove bio from users
--   - Add sector, cell, village to farms
--   - Remove latitude, longitude from farms
--   - Make ownerPhone optional
--   - Allow multiple farms per user
-- ============================================

-- 1. Update Users Table
-- Remove bio column
ALTER TABLE users DROP COLUMN IF EXISTS bio;

-- 2. Update Farms Table
-- Remove GPS coordinates
ALTER TABLE farms DROP COLUMN IF EXISTS latitude;
ALTER TABLE farms DROP COLUMN IF EXISTS longitude;

-- Add new location fields
ALTER TABLE farms ADD COLUMN IF NOT EXISTS sector VARCHAR(255);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS cell VARCHAR(255);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS village VARCHAR(255);

-- Make ownerPhone optional
ALTER TABLE farms ALTER COLUMN "ownerPhone" DROP NOT NULL;

-- Update existing farms with default values (if any exist)
UPDATE farms 
SET 
  sector = COALESCE(sector, ''),
  cell = COALESCE(cell, ''),
  village = COALESCE(village, '')
WHERE sector IS NULL OR cell IS NULL OR village IS NULL;

-- Make new columns NOT NULL after setting defaults
ALTER TABLE farms ALTER COLUMN sector SET NOT NULL;
ALTER TABLE farms ALTER COLUMN cell SET NOT NULL;
ALTER TABLE farms ALTER COLUMN village SET NOT NULL;

-- 3. Update Farm-User Relationship
-- Drop unique constraint on userId (allows multiple farms per user)
ALTER TABLE farms DROP CONSTRAINT IF EXISTS "UQ_farms_userId";
ALTER TABLE farms DROP CONSTRAINT IF EXISTS "REL_farms_userId";

-- Ensure foreign key exists with CASCADE delete
ALTER TABLE farms DROP CONSTRAINT IF EXISTS "FK_farms_userId";
ALTER TABLE farms ADD CONSTRAINT "FK_farms_userId" 
  FOREIGN KEY ("userId") 
  REFERENCES users(id) 
  ON DELETE CASCADE;
