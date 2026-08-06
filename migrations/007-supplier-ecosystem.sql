-- Migration 007: Supplier ecosystem, farm crops, enriched recommendations

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
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS suitable_crops TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS suitable_seasons TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS suitable_soil_types TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS service_regions TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0;

-- Supplier profile extensions
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS business_license_url VARCHAR;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS service_regions TEXT;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS operating_hours JSONB;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS delivery_capability BOOLEAN DEFAULT TRUE;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS verification_status approval_status_enum DEFAULT 'PENDING';

-- Recommendation AI metadata
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS crop_type VARCHAR;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS growing_season VARCHAR;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS soil_type VARCHAR;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS weather_conditions JSONB;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS disease_prediction VARCHAR;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,4);
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS ai_model_version VARCHAR;

-- Farm crops table
CREATE TABLE IF NOT EXISTS farm_crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop_type VARCHAR NOT NULL,
  variety VARCHAR,
  planting_season VARCHAR,
  planting_date DATE,
  expected_harvest_date DATE,
  harvest_season VARCHAR,
  status crop_status_enum DEFAULT 'PLANNED',
  estimated_yield DECIMAL(10,2),
  area_planted DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farm_crops_farm ON farm_crops(farm_id);
CREATE INDEX IF NOT EXISTS idx_farm_crops_crop_type ON farm_crops(crop_type);
CREATE INDEX IF NOT EXISTS idx_farm_crops_status ON farm_crops(status);
CREATE INDEX IF NOT EXISTS idx_products_archived ON products(is_archived);
