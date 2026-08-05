-- ============================================
-- Migration: Cart items + Payments
-- Date: 2026-08-05
-- ============================================

DO $$ BEGIN
  CREATE TYPE payments_method_enum AS ENUM (
    'cash_on_delivery',
    'mobile_money'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payments_status_enum AS ENUM (
    'pending',
    'paid',
    'failed',
    'cancelled',
    'refunded'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Extend notifications enum safely
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notifications_type_enum'
      AND e.enumlabel = 'payment_update'
  ) THEN
    ALTER TYPE notifications_type_enum ADD VALUE 'payment_update';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_cart_items_user_product" UNIQUE ("userId", "productId"),
  CONSTRAINT "FK_cart_items_userId"
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT "FK_cart_items_productId"
    FOREIGN KEY ("productId") REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_cart_items_userId" ON cart_items ("userId");

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL UNIQUE,
  "buyerId" UUID NOT NULL,
  method payments_method_enum NOT NULL,
  status payments_status_enum NOT NULL DEFAULT 'pending',
  amount NUMERIC(14,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'RWF',
  "providerReference" VARCHAR(255),
  "failureReason" TEXT,
  "paidAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_payments_orderId"
    FOREIGN KEY ("orderId") REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT "FK_payments_buyerId"
    FOREIGN KEY ("buyerId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_payments_buyerId" ON payments ("buyerId");
CREATE INDEX IF NOT EXISTS "IDX_payments_status" ON payments (status);
