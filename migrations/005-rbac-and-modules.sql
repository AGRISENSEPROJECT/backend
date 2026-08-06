-- Migration 005: RBAC, onboarding, supplier, community enhancements

-- User role enum
DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('FARMER', 'SUPPLIER', 'ADMIN', 'NGO', 'GOVERNMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User status enum
DO $$ BEGIN
  CREATE TYPE user_status_enum AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Identity verification status enum
DO $$ BEGIN
  CREATE TYPE identity_verification_status_enum AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new user columns (camelCase — matches TypeORM entities)
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

-- Post moderation columns
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "isReported" BOOLEAN DEFAULT FALSE;

-- Report enums
DO $$ BEGIN
  CREATE TYPE report_reason_enum AS ENUM ('SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'MISINFORMATION', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status_enum AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Post reports table (camelCase FKs matching PostReport entity)
CREATE TABLE IF NOT EXISTS post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "postId" UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  "reporterId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason report_reason_enum NOT NULL,
  description TEXT,
  status report_status_enum DEFAULT 'PENDING',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Chat messages table (camelCase matching ChatMessage entity)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "roomId" VARCHAR NOT NULL,
  "senderId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  "imageUrl" VARCHAR,
  "isRead" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Notifications table (camelCase — matches Notification entity / community module)
-- Prefer varchar type for community_* notification kinds
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

-- Product enums
DO $$ BEGIN
  CREATE TYPE product_category_enum AS ENUM ('SEEDS', 'FERTILIZER', 'TOOLS', 'CHEMICALS', 'EQUIPMENT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  category product_category_enum DEFAULT 'OTHER',
  "imageUrl" VARCHAR,
  stock INT DEFAULT 0,
  "isActive" BOOLEAN DEFAULT TRUE,
  "supplierId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Order enums
DO $$ BEGIN
  CREATE TYPE order_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "buyerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "productId" UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL,
  "totalPrice" DECIMAL(12,2) NOT NULL,
  status order_status_enum DEFAULT 'PENDING',
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_nationalId ON users("nationalId");
CREATE INDEX IF NOT EXISTS idx_farms_province ON farms(province);
CREATE INDEX IF NOT EXISTS idx_farms_district ON farms(district);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages("roomId");
CREATE INDEX IF NOT EXISTS "IDX_notifications_userId" ON notifications ("userId");
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products("supplierId");
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders("buyerId");
