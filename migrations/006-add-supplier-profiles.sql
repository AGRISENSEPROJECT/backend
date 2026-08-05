-- ============================================
-- Migration: Add supplier_profiles table
-- Date: 2026-08-05
-- Description:
--   - Add supplier_profiles_verificationstatus_enum
--   - Add supplier_profiles table linked 1:1 to users
-- ============================================

DO $$ BEGIN
  CREATE TYPE supplier_profiles_verificationstatus_enum AS ENUM (
    'pending',
    'approved',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS supplier_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL UNIQUE,
  "businessName" VARCHAR(255) NOT NULL,
  description TEXT,
  phone VARCHAR(255),
  country VARCHAR(255),
  province VARCHAR(255),
  district VARCHAR(255),
  sector VARCHAR(255),
  cell VARCHAR(255),
  village VARCHAR(255),
  address VARCHAR(255),
  "verificationStatus" supplier_profiles_verificationstatus_enum NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_supplier_profiles_userId"
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_supplier_profiles_verificationStatus"
  ON supplier_profiles ("verificationStatus");
