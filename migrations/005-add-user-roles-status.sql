-- ============================================
-- Migration: Add RBAC role and status to users
-- Date: 2026-08-05
-- Description:
--   - Add users_role_enum (farmer, supplier, admin)
--   - Add users_status_enum (pending, active, suspended)
--   - Add role and status columns to users
--   - Backfill existing users as farmer + active
-- ============================================

DO $$ BEGIN
  CREATE TYPE users_role_enum AS ENUM ('farmer', 'supplier', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE users_status_enum AS ENUM ('pending', 'active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role users_role_enum NOT NULL DEFAULT 'farmer';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status users_status_enum NOT NULL DEFAULT 'pending';

-- Existing accounts were already operating as farmers
UPDATE users
SET role = 'farmer'
WHERE role IS NULL OR role = 'farmer';

UPDATE users
SET status = 'active'
WHERE "isEmailVerified" = true
  AND status = 'pending';
