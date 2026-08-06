-- Waitlist entries for early-access / promotional checklist signups
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "fullName" VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  "phoneNumber" VARCHAR(30),
  interest VARCHAR(40) NOT NULL DEFAULT 'FARMER',
  organization VARCHAR(120),
  province VARCHAR(120),
  message TEXT,
  source VARCHAR(80),
  "welcomeEmailSent" BOOLEAN NOT NULL DEFAULT FALSE,
  "welcomeEmailSentAt" TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_interest ON waitlist_entries (interest);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_created_at ON waitlist_entries ("createdAt");
