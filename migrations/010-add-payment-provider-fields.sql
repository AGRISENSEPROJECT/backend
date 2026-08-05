-- ============================================
-- Migration: Payment provider fields (Flutterwave)
-- Date: 2026-08-05
-- ============================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS "checkoutUrl" VARCHAR(1024);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS "providerTransactionId" VARCHAR(255);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS "providerMeta" JSONB;

CREATE INDEX IF NOT EXISTS "IDX_payments_providerReference"
  ON payments ("providerReference");

CREATE INDEX IF NOT EXISTS "IDX_payments_providerTransactionId"
  ON payments ("providerTransactionId");
