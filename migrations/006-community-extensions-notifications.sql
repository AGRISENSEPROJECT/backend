-- ============================================
-- Migration: Community extensions + notifications
-- Date: 2026-08-06
-- Compatible with main's notifications work (008).
-- ============================================

-- Notifications (varchar type for merge-friendliness with community types)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(64) NOT NULL DEFAULT 'system',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_notifications_userId"
  ON notifications ("userId");
CREATE INDEX IF NOT EXISTS "IDX_notifications_userId_isRead"
  ON notifications ("userId", "isRead");
CREATE INDEX IF NOT EXISTS "IDX_notifications_createdAt"
  ON notifications ("createdAt" DESC);

-- If main already created an enum-backed notifications.type, add community values
DO $$ BEGIN
  ALTER TYPE notifications_type_enum ADD VALUE 'community_like';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notifications_type_enum ADD VALUE 'community_comment';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notifications_type_enum ADD VALUE 'community_reply';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notifications_type_enum ADD VALUE 'community_mention';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notifications_type_enum ADD VALUE 'community_message';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notifications_type_enum ADD VALUE 'community_group_invite';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- User blocks
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "blockerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "blockedId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("blockerId", "blockedId")
);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks ("blockerId");
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks ("blockedId");

-- Post reactions (beyond classic like)
CREATE TABLE IF NOT EXISTS post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "postId" UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL DEFAULT 'like',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "postId", type)
);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions ("postId");

-- Message read receipts
CREATE TABLE IF NOT EXISTS message_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "messageId" UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "readAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("messageId", "userId")
);
CREATE INDEX IF NOT EXISTS idx_message_receipts_message ON message_receipts ("messageId");

-- Post hashtags / mentions
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags JSONB NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS mentions JSONB NULL;

-- Nested comment replies + edit timestamp
ALTER TABLE comments ADD COLUMN IF NOT EXISTS "parentId" UUID NULL REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments ("parentId");

-- Soft-delete messages + mute conversations
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ NULL;
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS "mutedAt" TIMESTAMPTZ NULL;
