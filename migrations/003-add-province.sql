-- ============================================
-- Migration: Add Province Column to Farms
-- Date: 2026-01-30
-- Description: Add province field to farms table
-- ============================================

-- Add province column
ALTER TABLE farms ADD COLUMN IF NOT EXISTS province VARCHAR(255);

-- Set default value for existing farms
UPDATE farms 
SET province = COALESCE(province, '')
WHERE province IS NULL;

-- Make province NOT NULL after setting defaults
ALTER TABLE farms ALTER COLUMN province SET NOT NULL;
