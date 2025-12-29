-- =====================================================
-- ADD POST COMMENT LIKES MIGRATION (index_011.sql)
-- =====================================================
-- This migration adds support for liking post comments
-- =====================================================

-- Create post_comment_likes table
CREATE TABLE IF NOT EXISTS post_comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL DEFAULT 0,
  UNIQUE(comment_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_comment_likes_comment ON post_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_post_comment_likes_user ON post_comment_likes(user_id);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- The post_comment_likes table is now available for
-- storing likes on post comments.
-- =====================================================

