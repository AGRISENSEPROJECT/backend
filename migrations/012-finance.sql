-- CFO finance domain: accounts, categories, transactions, audit trail.
-- Also adds CFO to the existing user role enum.

ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'CFO';

CREATE TABLE IF NOT EXISTS finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  type VARCHAR(40) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'RWF',
  institution VARCHAR(160),
  "accountNumber" VARCHAR(80),
  description TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" UUID REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS IDX_finance_accounts_type ON finance_accounts (type);
CREATE INDEX IF NOT EXISTS IDX_finance_accounts_createdById ON finance_accounts ("createdById");

CREATE TABLE IF NOT EXISTS finance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  description TEXT,
  color VARCHAR(16),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" UUID REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT UQ_finance_categories_name_kind UNIQUE (name, kind)
);

CREATE INDEX IF NOT EXISTS IDX_finance_categories_kind ON finance_categories (kind);
CREATE INDEX IF NOT EXISTS IDX_finance_categories_createdById ON finance_categories ("createdById");

CREATE TABLE IF NOT EXISTS finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'RWF',
  "occurredAt" TIMESTAMPTZ NOT NULL,
  description VARCHAR(240) NOT NULL,
  notes TEXT,
  reference VARCHAR(80),
  counterparty VARCHAR(160),
  "accountId" UUID NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  "categoryId" UUID NOT NULL REFERENCES finance_categories(id) ON DELETE RESTRICT,
  "createdById" UUID REFERENCES users(id) ON DELETE SET NULL,
  "approvedById" UUID REFERENCES users(id) ON DELETE SET NULL,
  "approvedAt" TIMESTAMPTZ,
  "rejectedById" UUID,
  "rejectedAt" TIMESTAMPTZ,
  "rejectionReason" TEXT,
  "cancelledById" UUID,
  "cancelledAt" TIMESTAMPTZ,
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS IDX_finance_transactions_type ON finance_transactions (type);
CREATE INDEX IF NOT EXISTS IDX_finance_transactions_status ON finance_transactions (status);
CREATE INDEX IF NOT EXISTS IDX_finance_transactions_occurredAt ON finance_transactions ("occurredAt");
CREATE INDEX IF NOT EXISTS IDX_finance_transactions_accountId ON finance_transactions ("accountId");
CREATE INDEX IF NOT EXISTS IDX_finance_transactions_categoryId ON finance_transactions ("categoryId");
CREATE INDEX IF NOT EXISTS IDX_finance_transactions_createdById ON finance_transactions ("createdById");
CREATE INDEX IF NOT EXISTS IDX_finance_transactions_reference ON finance_transactions (reference);

CREATE TABLE IF NOT EXISTS finance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(40) NOT NULL,
  "entityType" VARCHAR(40) NOT NULL,
  "entityId" UUID NOT NULL,
  "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS IDX_finance_audit_logs_action ON finance_audit_logs (action);
CREATE INDEX IF NOT EXISTS IDX_finance_audit_logs_entityType ON finance_audit_logs ("entityType");
CREATE INDEX IF NOT EXISTS IDX_finance_audit_logs_entityId ON finance_audit_logs ("entityId");
CREATE INDEX IF NOT EXISTS IDX_finance_audit_logs_userId ON finance_audit_logs ("userId");
