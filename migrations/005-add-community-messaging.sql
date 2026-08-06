-- Community messaging tables + unique likes

DO $$ BEGIN
  CREATE TYPE conversation_type_enum AS ENUM ('direct', 'group');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type conversation_type_enum NOT NULL DEFAULT 'direct',
  name varchar NULL,
  "createdById" uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "lastReadAt" TIMESTAMPTZ NULL,
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("conversationId", "userId")
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  "senderId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages ("conversationId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON conversation_members ("userId");

-- Ensure posts/comments/likes exist (safe if already created via synchronize)
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description varchar NULL,
  "imageUrl" varchar NULL,
  "userId" uuid NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content varchar NOT NULL,
  "userId" uuid NULL REFERENCES users(id) ON DELETE CASCADE,
  "postId" uuid NULL REFERENCES posts(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NULL REFERENCES users(id) ON DELETE CASCADE,
  "postId" uuid NULL REFERENCES posts(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_user_post ON likes ("userId", "postId");
