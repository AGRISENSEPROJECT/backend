-- Migration 007: Supplier ecosystem, farm crops, enriched recommendations
-- camelCase columns match TypeORM entities

DO $$ BEGIN
  CREATE TYPE crop_status_enum AS ENUM ('PLANNED', 'PLANTED', 'GROWING', 'READY_FOR_HARVEST', 'HARVESTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Expand product categories
ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'PESTICIDE';
ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'HERBICIDE';
ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'IRRIGATION';
ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'LIVESTOCK';
ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'MACHINERY';

-- Product extensions
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "suitableCrops" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "suitableSeasons" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "suitableSoilTypes" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "serviceRegions" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "ratingCount" INT DEFAULT 0;

-- Supplier profile extensions
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS "businessLicenseUrl" VARCHAR;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS "serviceRegions" TEXT;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS "operatingHours" JSONB;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS "deliveryCapability" BOOLEAN DEFAULT TRUE;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS "ratingCount" INT DEFAULT 0;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS "verificationStatus" approval_status_enum DEFAULT 'PENDING';

-- Recommendation AI metadata
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS "cropType" VARCHAR;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS "growingSeason" VARCHAR;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS "soilType" VARCHAR;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS "weatherConditions" JSONB;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS "diseasePrediction" VARCHAR;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS "confidenceScore" DECIMAL(5,4);
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS "aiModelVersion" VARCHAR;

-- Farm crops table
CREATE TABLE IF NOT EXISTS farm_crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "cropType" VARCHAR NOT NULL,
  variety VARCHAR,
  "plantingSeason" VARCHAR,
  "plantingDate" DATE,
  "expectedHarvestDate" DATE,
  "harvestSeason" VARCHAR,
  status crop_status_enum DEFAULT 'PLANNED',
  "estimatedYield" DECIMAL(10,2),
  "areaPlanted" DECIMAL(10,2),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farm_crops_farm ON farm_crops("farmId");
CREATE INDEX IF NOT EXISTS idx_farm_crops_crop_type ON farm_crops("cropType");
CREATE INDEX IF NOT EXISTS idx_farm_crops_status ON farm_crops(status);
CREATE INDEX IF NOT EXISTS idx_products_archived ON products("isArchived");
