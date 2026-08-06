-- Remove username field; users are identified by email and optional unique phone
ALTER TABLE users DROP COLUMN IF EXISTS username;

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
