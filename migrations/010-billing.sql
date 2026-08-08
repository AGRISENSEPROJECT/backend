-- Subscription & billing schema (Flutterwave / RWF)

CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  "priceMonthly" INTEGER,
  "priceAnnualPerMonth" INTEGER,
  limits JSONB NOT NULL,
  "isPublic" BOOLEAN NOT NULL DEFAULT TRUE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "planId" VARCHAR(40) NOT NULL REFERENCES subscription_plans(id),
  "billingCycle" VARCHAR(20),
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  "paymentMethod" VARCHAR(20) NOT NULL DEFAULT 'none',
  provider VARCHAR(40),
  "providerCustomerId" VARCHAR(120),
  "providerSubscriptionId" VARCHAR(120),
  "providerPaymentRef" VARCHAR(120),
  amount INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'RWF',
  "currentPeriodStart" TIMESTAMPTZ,
  "currentPeriodEnd" TIMESTAMPTZ,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT FALSE,
  "canceledAt" TIMESTAMPTZ,
  "paymentLabel" VARCHAR(120),
  "isCurrent" BOOLEAN NOT NULL DEFAULT TRUE,
  "adminNote" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions ("userId");
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_current ON user_subscriptions ("userId", "isCurrent");
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON user_subscriptions ("planId");

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "subscriptionId" UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'RWF',
  method VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'initiated',
  provider VARCHAR(40) NOT NULL DEFAULT 'flutterwave',
  "providerRef" VARCHAR(160) NOT NULL UNIQUE,
  "checkoutId" VARCHAR(160),
  "rawWebhookPayload" JSONB,
  "failureReason" TEXT,
  "paymentLabel" VARCHAR(120),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions ("userId");
CREATE INDEX IF NOT EXISTS idx_payment_transactions_checkout ON payment_transactions ("checkoutId");
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions (status);

CREATE TABLE IF NOT EXISTS enterprise_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
  "organizationName" VARCHAR(160) NOT NULL,
  "contactName" VARCHAR(160) NOT NULL,
  "contactEmail" VARCHAR(255) NOT NULL,
  "contactPhone" VARCHAR(40),
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_leads_user ON enterprise_leads ("userId");
CREATE INDEX IF NOT EXISTS idx_enterprise_leads_status ON enterprise_leads (status);

-- Seed public plans (idempotent upsert)
INSERT INTO subscription_plans (
  id, name, description, features, "priceMonthly", "priceAnnualPerMonth", limits, "isPublic", "isActive"
) VALUES
(
  'starter',
  'Starter',
  'Forever free for farmers getting started with AgriSense.',
  '["1 farm","Basic farm records","3-day weather outlook","Community access","Marketplace browsing"]'::jsonb,
  0,
  0,
  '{"maxFarms":1,"weatherDays":3,"aiRecommendations":false,"unlimitedSoilReports":false,"marketInsights":false,"prioritySupport":false}'::jsonb,
  TRUE,
  TRUE
),
(
  'pro',
  'Pro',
  'Advanced AI, more farms, and full agricultural insights.',
  '["Up to 10 farms","AI crop disease recommendations","Unlimited soil & crop reports","7-day weather outlook","Market insights","Priority notification alerts"]'::jsonb,
  10000,
  8000,
  '{"maxFarms":10,"weatherDays":7,"aiRecommendations":true,"unlimitedSoilReports":true,"marketInsights":true,"prioritySupport":false}'::jsonb,
  TRUE,
  TRUE
),
(
  'enterprise',
  'Enterprise',
  'Custom pricing for organizations, NGOs, and government partners.',
  '["Unlimited farms (org-level)","Dedicated onboarding","Regional analytics","Custom SLAs","Priority support"]'::jsonb,
  NULL,
  NULL,
  '{"maxFarms":null,"weatherDays":null,"aiRecommendations":true,"unlimitedSoilReports":true,"marketInsights":true,"prioritySupport":true}'::jsonb,
  TRUE,
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  "priceMonthly" = EXCLUDED."priceMonthly",
  "priceAnnualPerMonth" = EXCLUDED."priceAnnualPerMonth",
  limits = EXCLUDED.limits,
  "isPublic" = EXCLUDED."isPublic",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();

-- Default existing farmers without a current subscription to Starter
INSERT INTO user_subscriptions (
  "userId", "planId", status, "paymentMethod", amount, currency, "currentPeriodStart", "isCurrent"
)
SELECT u.id, 'starter', 'active', 'none', 0, 'RWF', NOW(), TRUE
FROM users u
WHERE u.role = 'FARMER'
  AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions s WHERE s."userId" = u.id AND s."isCurrent" = TRUE
  );

-- Extend audit action enum for billing admin actions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'audit_action_enum' AND e.enumlabel = 'SUBSCRIPTION_ASSIGNED'
  ) THEN
    ALTER TYPE audit_action_enum ADD VALUE 'SUBSCRIPTION_ASSIGNED';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'audit_action_enum' AND e.enumlabel = 'SUBSCRIPTION_REVOKED'
  ) THEN
    ALTER TYPE audit_action_enum ADD VALUE 'SUBSCRIPTION_REVOKED';
  END IF;
END $$;
