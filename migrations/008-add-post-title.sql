-- Add short title for community posts (dashboard cards)

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS title VARCHAR(120) NULL;
