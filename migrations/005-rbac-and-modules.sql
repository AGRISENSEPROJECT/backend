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

-- Add new user columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id VARCHAR UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role_enum DEFAULT 'FARMER';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status user_status_enum DEFAULT 'PENDING';
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step INT DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS document_type VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_image_url VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verification_status identity_verification_status_enum;
ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_regions TEXT;

-- Post moderation columns
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_reported BOOLEAN DEFAULT FALSE;

-- Report enums
DO $$ BEGIN
  CREATE TYPE report_reason_enum AS ENUM ('SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'MISINFORMATION', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status_enum AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Post reports table
CREATE TABLE IF NOT EXISTS post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason report_reason_enum NOT NULL,
  description TEXT,
  status report_status_enum DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR NOT NULL,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url VARCHAR,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Notification enums
DO $$ BEGIN
  CREATE TYPE notification_type_enum AS ENUM ('SYSTEM', 'PREDICTION', 'COMMUNITY', 'FARM', 'ORDER', 'MODERATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type_enum DEFAULT 'SYSTEM',
  title VARCHAR NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
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
  image_url VARCHAR,
  stock INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  supplier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Order enums
DO $$ BEGIN
  CREATE TYPE order_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  status order_status_enum DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_national_id ON users(national_id);
CREATE INDEX IF NOT EXISTS idx_farms_province ON farms(province);
CREATE INDEX IF NOT EXISTS idx_farms_district ON farms(district);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
