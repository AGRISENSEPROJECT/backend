-- Cascade post deletes to comments / likes / reactions

DO $$
DECLARE
  comments_fk text;
BEGIN
  SELECT con.conname INTO comments_fk
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'comments'
    AND con.contype = 'f'
    AND pg_get_constraintdef(con.oid) ILIKE '%postId%';

  IF comments_fk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE comments DROP CONSTRAINT %I', comments_fk);
  END IF;
END $$;

ALTER TABLE comments
  ADD CONSTRAINT "FK_comments_postId"
  FOREIGN KEY ("postId") REFERENCES posts(id) ON DELETE CASCADE;

DO $$
DECLARE
  likes_fk text;
BEGIN
  SELECT con.conname INTO likes_fk
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'likes'
    AND con.contype = 'f'
    AND pg_get_constraintdef(con.oid) ILIKE '%postId%';

  IF likes_fk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE likes DROP CONSTRAINT %I', likes_fk);
  END IF;
END $$;

ALTER TABLE likes
  DROP CONSTRAINT IF EXISTS "FK_likes_postId";

ALTER TABLE likes
  ADD CONSTRAINT "FK_likes_postId"
  FOREIGN KEY ("postId") REFERENCES posts(id) ON DELETE CASCADE;

-- post_reactions already created with CASCADE in 006; ensure if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'post_reactions'
  ) THEN
    ALTER TABLE post_reactions DROP CONSTRAINT IF EXISTS "FK_post_reactions_postId";
    -- drop any existing postId FK by name discovery
    BEGIN
      ALTER TABLE post_reactions
        ADD CONSTRAINT "FK_post_reactions_postId"
        FOREIGN KEY ("postId") REFERENCES posts(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
