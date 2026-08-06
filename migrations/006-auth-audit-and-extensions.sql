-- Migration 006: Auth audit, soft delete, farm archive, supplier/NGO profiles

ALTER TABLE users ADD COLUMN IF NOT EXISTS active_farm_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE farms ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS image_url VARCHAR;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS irrigation_method VARCHAR;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS crop_history TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS farming_practices TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS soil_information TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

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
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR,
  ip_address VARCHAR,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR NOT NULL,
  business_description TEXT,
  business_location VARCHAR NOT NULL,
  business_category VARCHAR NOT NULL,
  contact_phone VARCHAR,
  contact_email VARCHAR,
  logo_url VARCHAR,
  approval_status approval_status_enum DEFAULT 'PENDING',
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ngo_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_name VARCHAR NOT NULL,
  description TEXT,
  registration_number VARCHAR,
  contact_email VARCHAR,
  contact_phone VARCHAR,
  website VARCHAR,
  logo_url VARCHAR,
  focus_areas TEXT,
  approval_status approval_status_enum DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agricultural_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  description TEXT,
  target_regions TEXT,
  budget VARCHAR,
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS government_advisories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  content TEXT NOT NULL,
  type advisory_type_enum DEFAULT 'GENERAL',
  target_regions TEXT,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_farms_archived ON farms(is_archived);
