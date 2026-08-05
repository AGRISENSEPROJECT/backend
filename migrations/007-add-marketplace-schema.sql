-- ============================================
-- Migration: Marketplace products and orders
-- Date: 2026-08-05
-- Description:
--   - Add products table
--   - Add orders + order_items tables
-- ============================================

DO $$ BEGIN
  CREATE TYPE orders_status_enum AS ENUM (
    'pending',
    'confirmed',
    'shipped',
    'delivered',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "supplierProfileId" UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(255),
  price NUMERIC(12,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL DEFAULT 'unit',
  "imageUrl" VARCHAR(1024),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_products_supplierProfileId"
    FOREIGN KEY ("supplierProfileId") REFERENCES supplier_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_products_supplierProfileId"
  ON products ("supplierProfileId");
CREATE INDEX IF NOT EXISTS "IDX_products_isActive"
  ON products ("isActive");

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "buyerId" UUID NOT NULL,
  "supplierProfileId" UUID NOT NULL,
  status orders_status_enum NOT NULL DEFAULT 'pending',
  "totalAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "deliveryAddress" TEXT,
  notes TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_orders_buyerId"
    FOREIGN KEY ("buyerId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT "FK_orders_supplierProfileId"
    FOREIGN KEY ("supplierProfileId") REFERENCES supplier_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_orders_buyerId" ON orders ("buyerId");
CREATE INDEX IF NOT EXISTS "IDX_orders_supplierProfileId" ON orders ("supplierProfileId");
CREATE INDEX IF NOT EXISTS "IDX_orders_status" ON orders (status);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  quantity INTEGER NOT NULL,
  "unitPrice" NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(14,2) NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_order_items_orderId"
    FOREIGN KEY ("orderId") REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT "FK_order_items_productId"
    FOREIGN KEY ("productId") REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "IDX_order_items_orderId" ON order_items ("orderId");
CREATE INDEX IF NOT EXISTS "IDX_order_items_productId" ON order_items ("productId");
