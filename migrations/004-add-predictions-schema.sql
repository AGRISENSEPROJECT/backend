-- ============================================
-- Migration: Add Soil Scans, Prediction Runs, and Recommendations
-- Date: 2026-02-24
-- Description:
--   - Add soil_scans table
--   - Add prediction_runs table
--   - Add recommendations table
-- ============================================

DO $$ BEGIN
  CREATE TYPE soil_scans_source_enum AS ENUM ('manual', 'image');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE prediction_runs_status_enum AS ENUM ('pending', 'success', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE recommendations_type_enum AS ENUM ('crop', 'fertilizer', 'irrigation', 'general');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS soil_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "farmId" UUID NOT NULL,
  source soil_scans_source_enum NOT NULL DEFAULT 'manual',
  moisture NUMERIC(8,2),
  temperature NUMERIC(8,2),
  "phLevel" NUMERIC(8,2),
  "soilType" VARCHAR(255),
  "organicLevels" NUMERIC(8,2),
  "soilColor" VARCHAR(255),
  "soilStructure" VARCHAR(255),
  nitrogen NUMERIC(10,2),
  phosphorus NUMERIC(10,2),
  potassium NUMERIC(10,2),
  "propertyRates" JSONB,
  "npkRates" JSONB,
  "rawImageUrl" VARCHAR(1024),
  "rawInput" JSONB,
  "scannedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_soil_scans_userId" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT "FK_soil_scans_farmId" FOREIGN KEY ("farmId") REFERENCES farms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_soil_scans_userId_scannedAt" ON soil_scans ("userId", "scannedAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_soil_scans_farmId_scannedAt" ON soil_scans ("farmId", "scannedAt" DESC);

CREATE TABLE IF NOT EXISTS prediction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "farmId" UUID NOT NULL,
  "soilScanId" UUID,
  "modelName" VARCHAR(255) NOT NULL DEFAULT 'agrisense-model',
  "modelVersion" VARCHAR(255),
  status prediction_runs_status_enum NOT NULL DEFAULT 'pending',
  "inputPayload" JSONB,
  "predictionSummary" JSONB,
  "rawResponse" JSONB,
  "errorMessage" TEXT,
  "executedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_prediction_runs_userId" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT "FK_prediction_runs_farmId" FOREIGN KEY ("farmId") REFERENCES farms(id) ON DELETE CASCADE,
  CONSTRAINT "FK_prediction_runs_soilScanId" FOREIGN KEY ("soilScanId") REFERENCES soil_scans(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "IDX_prediction_runs_userId_executedAt" ON prediction_runs ("userId", "executedAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_prediction_runs_farmId_executedAt" ON prediction_runs ("farmId", "executedAt" DESC);

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "predictionId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "farmId" UUID NOT NULL,
  type recommendations_type_enum NOT NULL DEFAULT 'general',
  title VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  rank INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_recommendations_predictionId" FOREIGN KEY ("predictionId") REFERENCES prediction_runs(id) ON DELETE CASCADE,
  CONSTRAINT "FK_recommendations_userId" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT "FK_recommendations_farmId" FOREIGN KEY ("farmId") REFERENCES farms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_recommendations_predictionId_rank" ON recommendations ("predictionId", rank ASC);
CREATE INDEX IF NOT EXISTS "IDX_recommendations_userId_createdAt" ON recommendations ("userId", "createdAt" DESC);
