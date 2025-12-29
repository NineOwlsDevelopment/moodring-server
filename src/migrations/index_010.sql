-- =====================================================
-- ADD VIDEO URL TO POSTS MIGRATION (index_010.sql)
-- =====================================================
-- This migration adds support for video attachments on posts
-- =====================================================

-- Add video_url column to posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- The video_url column is now available for storing
-- video attachments on posts.
-- =====================================================

