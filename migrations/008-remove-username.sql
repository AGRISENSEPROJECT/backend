-- Remove username after preserving display name in firstName
-- Safe for DBs that still only have the legacy username column

ALTER TABLE users ADD COLUMN IF NOT EXISTS "firstName" VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastName" VARCHAR;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username'
  ) THEN
    EXECUTE 'UPDATE users SET "firstName" = username WHERE ("firstName" IS NULL OR "firstName" = '''') AND username IS NOT NULL';
    EXECUTE 'ALTER TABLE users ALTER COLUMN username DROP NOT NULL';
    EXECUTE 'ALTER TABLE users DROP COLUMN IF EXISTS username';
  END IF;
END $$;

-- Ensure phone numbers are unique when present (column name varies by schema history)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phoneNumber'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique ON users ("phoneNumber") WHERE "phoneNumber" IS NOT NULL';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone_number'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique ON users (phone_number) WHERE phone_number IS NOT NULL';
  END IF;
END $$;
