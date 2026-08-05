-- ============================================
-- Migration: Add notifications table
-- Date: 2026-08-05
-- ============================================

DO $$ BEGIN
  CREATE TYPE notifications_type_enum AS ENUM (
    'system',
    'supplier_approved',
    'supplier_rejected',
    'order_placed',
    'order_status',
    'prediction_ready',
    'prediction_failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  type notifications_type_enum NOT NULL DEFAULT 'system',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_notifications_userId"
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_notifications_userId"
  ON notifications ("userId");
CREATE INDEX IF NOT EXISTS "IDX_notifications_userId_isRead"
  ON notifications ("userId", "isRead");
CREATE INDEX IF NOT EXISTS "IDX_notifications_createdAt"
  ON notifications ("createdAt" DESC);
