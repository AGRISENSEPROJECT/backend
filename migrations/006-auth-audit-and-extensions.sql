-- Migration 006: Auth audit, soft delete, farm archive, supplier/NGO profiles
-- camelCase columns match TypeORM entities

ALTER TABLE users ADD COLUMN IF NOT EXISTS "activeFarmId" UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

ALTER TABLE farms ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "imageUrl" VARCHAR;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT FALSE;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT FALSE;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "irrigationMethod" VARCHAR;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "cropHistory" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "farmingPractices" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "soilInformation" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP;

DO $$ BEGIN
  CREATE TYPE approval_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_action_enum AS ENUM (
    'REGISTER', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET', 'PASSWORD_CHANGE',
    'EMAIL_VERIFY', 'TOKEN_REFRESH', 'USER_SUSPENDED', 'USER_REACTIVATED', 'USER_DELETED',
    'USER_RESTORED', 'SUPPLIER_APPROVED', 'SUPPLIER_REJECTED', 'NGO_APPROVED', 'NGO_REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE advisory_type_enum AS ENUM ('GENERAL', 'WEATHER', 'DISEASE', 'EMERGENCY', 'FOOD_SECURITY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action audit_action_enum NOT NULL,
  "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR,
  "ipAddress" VARCHAR,
  metadata JSONB,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  "businessName" VARCHAR NOT NULL,
  "businessDescription" TEXT,
  "businessLocation" VARCHAR NOT NULL,
  "businessCategory" VARCHAR NOT NULL,
  "contactPhone" VARCHAR,
  "contactEmail" VARCHAR,
  "logoUrl" VARCHAR,
  "approvalStatus" approval_status_enum DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ngo_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  "organizationName" VARCHAR NOT NULL,
  description TEXT,
  "registrationNumber" VARCHAR,
  "contactEmail" VARCHAR,
  "contactPhone" VARCHAR,
  website VARCHAR,
  "logoUrl" VARCHAR,
  "focusAreas" TEXT,
  "approvalStatus" approval_status_enum DEFAULT 'PENDING',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agricultural_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  description TEXT,
  "targetRegions" TEXT,
  budget VARCHAR,
  "isActive" BOOLEAN DEFAULT TRUE,
  "startDate" DATE,
  "endDate" DATE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS government_advisories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "authorId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  content TEXT NOT NULL,
  type advisory_type_enum DEFAULT 'GENERAL',
  "targetRegions" TEXT,
  "isPublished" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs("userId");
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users("deletedAt");
CREATE INDEX IF NOT EXISTS idx_farms_archived ON farms("isArchived");
