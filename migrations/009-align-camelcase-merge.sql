-- ============================================
-- 009: Align production schema after community + RBAC merge
-- - Adds camelCase columns TypeORM entities expect
-- - Backfills firstName from legacy username
-- - Softens username NOT NULL (drop happens in 008 only after backfill —
--   this file is ordered AFTER 008 in name sort? NO: 008 < 009.
--   So 008-remove-username must be fixed to backfill first.
-- This migration is the safety net for any environment.
-- ============================================

-- Enums (no-op if already created by 005-rbac)
DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('FARMER', 'SUPPLIER', 'ADMIN', 'NGO', 'GOVERNMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status_enum AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE identity_verification_status_enum AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users: camelCase RBAC columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS "firstName" VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastName" VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "nationalId" VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role_enum DEFAULT 'FARMER';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status user_status_enum DEFAULT 'PENDING';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "onboardingStep" INT DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "documentType" VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "idImageUrl" VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "identityVerificationStatus" identity_verification_status_enum;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "nationalIdVerified" BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "assignedRegions" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "activeFarmId" UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Copy from snake_case leftovers if a prior broken migration created them
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'first_name'
  ) THEN
    EXECUTE 'UPDATE users SET "firstName" = first_name WHERE "firstName" IS NULL AND first_name IS NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_name'
  ) THEN
    EXECUTE 'UPDATE users SET "lastName" = last_name WHERE "lastName" IS NULL AND last_name IS NOT NULL';
  END IF;
END $$;

-- Backfill from legacy username
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'username'
  ) THEN
    EXECUTE 'UPDATE users SET "firstName" = username WHERE ("firstName" IS NULL OR "firstName" = '''') AND username IS NOT NULL';
    EXECUTE 'ALTER TABLE users ALTER COLUMN username DROP NOT NULL';
  END IF;
END $$;

-- Posts moderation + title
ALTER TABLE posts ADD COLUMN IF NOT EXISTS title VARCHAR(120);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "isReported" BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'is_hidden'
  ) THEN
    EXECUTE 'UPDATE posts SET "isHidden" = is_hidden WHERE is_hidden IS NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'is_reported'
  ) THEN
    EXECUTE 'UPDATE posts SET "isReported" = is_reported WHERE is_reported IS NOT NULL';
  END IF;
END $$;

-- Community extras used by entities but missing from earlier SQL
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "imageUrl" VARCHAR;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMPTZ;

-- Notifications: ensure camelCase shape used by Notification entity
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(64) NOT NULL DEFAULT 'system',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "userId" UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- If only snake_case notification columns exist, copy into camelCase
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'user_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'userId'
  ) THEN
    EXECUTE 'UPDATE notifications SET "userId" = user_id WHERE "userId" IS NULL AND user_id IS NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'metadata'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'data'
  ) THEN
    EXECUTE 'UPDATE notifications SET data = metadata WHERE data IS NULL AND metadata IS NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'isRead'
  ) THEN
    EXECUTE 'UPDATE notifications SET "isRead" = is_read WHERE is_read IS NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_notifications_userId" ON notifications ("userId");
