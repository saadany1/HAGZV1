-- Recreate push_token column in user_profiles table
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the existing push_token column (if it exists)
ALTER TABLE user_profiles DROP COLUMN IF EXISTS push_token;

-- Step 2: Add the push_token column with proper settings
ALTER TABLE user_profiles 
ADD COLUMN push_token TEXT NULL;

-- Step 3: Add an index for better performance when querying push tokens
CREATE INDEX IF NOT EXISTS idx_user_profiles_push_token 
ON user_profiles(push_token) 
WHERE push_token IS NOT NULL;

-- Step 4: Add a comment to document the column
COMMENT ON COLUMN user_profiles.push_token IS 'Expo push notification token for sending push notifications';

-- Step 5: Verify the column was created
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' AND column_name = 'push_token';
