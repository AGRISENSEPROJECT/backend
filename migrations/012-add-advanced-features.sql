-- ============================================
-- Migration: Advanced platform features
-- Weather, IoT, Yield, Cooperatives, Community moderation, Audit logs
-- Date: 2026-08-06
-- ============================================

DO $$ BEGIN
  CREATE TYPE weather_alerts_severity_enum AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE iot_sensors_status_enum AS ENUM ('active', 'inactive', 'faulty');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE yield_forecasts_status_enum AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE cooperative_members_role_enum AS ENUM ('member', 'officer', 'chair');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE post_reports_status_enum AS ENUM ('pending', 'reviewed', 'dismissed', 'actioned');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notifications_type_enum' AND e.enumlabel = 'weather_alert'
  ) THEN
    ALTER TYPE notifications_type_enum ADD VALUE 'weather_alert';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notifications_type_enum' AND e.enumlabel = 'iot_alert'
  ) THEN
    ALTER TYPE notifications_type_enum ADD VALUE 'iot_alert';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS weather_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province VARCHAR(255),
  district VARCHAR(255),
  "farmId" UUID,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  severity weather_alerts_severity_enum NOT NULL DEFAULT 'info',
  source VARCHAR(100) NOT NULL DEFAULT 'openweather',
  "rawPayload" JSONB,
  "startsAt" TIMESTAMPTZ,
  "endsAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_weather_alerts_farmId" FOREIGN KEY ("farmId") REFERENCES farms(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "IDX_weather_alerts_province" ON weather_alerts (province);
CREATE INDEX IF NOT EXISTS "IDX_weather_alerts_farmId" ON weather_alerts ("farmId");

CREATE TABLE IF NOT EXISTS iot_sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  "deviceId" VARCHAR(255) NOT NULL UNIQUE,
  "sensorType" VARCHAR(100) NOT NULL DEFAULT 'soil_moisture',
  unit VARCHAR(50) NOT NULL DEFAULT '%',
  status iot_sensors_status_enum NOT NULL DEFAULT 'active',
  location VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_iot_sensors_farmId" FOREIGN KEY ("farmId") REFERENCES farms(id) ON DELETE CASCADE,
  CONSTRAINT "FK_iot_sensors_userId" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sensorId" UUID NOT NULL,
  value NUMERIC(14,4) NOT NULL,
  unit VARCHAR(50),
  metadata JSONB,
  "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_sensor_readings_sensorId" FOREIGN KEY ("sensorId") REFERENCES iot_sensors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_sensor_readings_sensorId" ON sensor_readings ("sensorId");
CREATE INDEX IF NOT EXISTS "IDX_sensor_readings_recordedAt" ON sensor_readings ("recordedAt" DESC);

CREATE TABLE IF NOT EXISTS yield_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "cropType" VARCHAR(255) NOT NULL,
  "predictedYieldTons" NUMERIC(14,4) NOT NULL,
  confidence NUMERIC(5,2),
  method VARCHAR(100) NOT NULL DEFAULT 'baseline_v1',
  inputs JSONB,
  notes TEXT,
  status yield_forecasts_status_enum NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_yield_forecasts_farmId" FOREIGN KEY ("farmId") REFERENCES farms(id) ON DELETE CASCADE,
  CONSTRAINT "FK_yield_forecasts_userId" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cooperatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  province VARCHAR(255),
  district VARCHAR(255),
  "chairUserId" UUID,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_cooperatives_chairUserId" FOREIGN KEY ("chairUserId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cooperative_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cooperativeId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  role cooperative_members_role_enum NOT NULL DEFAULT 'member',
  "joinedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_cooperative_members" UNIQUE ("cooperativeId", "userId"),
  CONSTRAINT "FK_coop_members_coop" FOREIGN KEY ("cooperativeId") REFERENCES cooperatives(id) ON DELETE CASCADE,
  CONSTRAINT "FK_coop_members_user" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "postId" UUID NOT NULL,
  "reporterId" UUID NOT NULL,
  reason VARCHAR(255) NOT NULL,
  details TEXT,
  status post_reports_status_enum NOT NULL DEFAULT 'pending',
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_post_reports_postId" FOREIGN KEY ("postId") REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT "FK_post_reports_reporterId" FOREIGN KEY ("reporterId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT "FK_post_reports_reviewedById" FOREIGN KEY ("reviewedById") REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "IDX_post_reports_status" ON post_reports (status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId" UUID,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  "resourceId" VARCHAR(100),
  metadata JSONB,
  "ipAddress" VARCHAR(100),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_audit_logs_actorId" FOREIGN KEY ("actorId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actorId" ON audit_logs ("actorId");
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_resource" ON audit_logs (resource);
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_createdAt" ON audit_logs ("createdAt" DESC);
