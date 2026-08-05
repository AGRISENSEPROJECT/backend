-- ============================================
-- Migration: NGO + Government roles and modules
-- Date: 2026-08-05
-- ============================================

-- Extend users_role_enum
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'users_role_enum' AND e.enumlabel = 'ngo'
  ) THEN
    ALTER TYPE users_role_enum ADD VALUE 'ngo';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'users_role_enum' AND e.enumlabel = 'government'
  ) THEN
    ALTER TYPE users_role_enum ADD VALUE 'government';
  END IF;
END $$;

-- Notification types for org approval
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notifications_type_enum' AND e.enumlabel = 'organization_approved'
  ) THEN
    ALTER TYPE notifications_type_enum ADD VALUE 'organization_approved';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notifications_type_enum' AND e.enumlabel = 'organization_rejected'
  ) THEN
    ALTER TYPE notifications_type_enum ADD VALUE 'organization_rejected';
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE organizations_type_enum AS ENUM ('ngo', 'government');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE organizations_verificationstatus_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE programs_status_enum AS ENUM ('draft', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL UNIQUE,
  type organizations_type_enum NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  phone VARCHAR(255),
  country VARCHAR(255),
  province VARCHAR(255),
  district VARCHAR(255),
  "assignedRegions" JSONB,
  "verificationStatus" organizations_verificationstatus_enum NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_organizations_userId"
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_organizations_type" ON organizations (type);
CREATE INDEX IF NOT EXISTS "IDX_organizations_verificationStatus"
  ON organizations ("verificationStatus");

CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  province VARCHAR(255),
  district VARCHAR(255),
  status programs_status_enum NOT NULL DEFAULT 'draft',
  "startDate" DATE,
  "endDate" DATE,
  "targetFarmers" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_programs_organizationId"
    FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_programs_organizationId" ON programs ("organizationId");
CREATE INDEX IF NOT EXISTS "IDX_programs_status" ON programs (status);

CREATE TABLE IF NOT EXISTS program_farmers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "programId" UUID NOT NULL,
  "farmerId" UUID NOT NULL,
  notes TEXT,
  "assignedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_program_farmers_program_farmer" UNIQUE ("programId", "farmerId"),
  CONSTRAINT "FK_program_farmers_programId"
    FOREIGN KEY ("programId") REFERENCES programs(id) ON DELETE CASCADE,
  CONSTRAINT "FK_program_farmers_farmerId"
    FOREIGN KEY ("farmerId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_program_farmers_programId" ON program_farmers ("programId");
CREATE INDEX IF NOT EXISTS "IDX_program_farmers_farmerId" ON program_farmers ("farmerId");
