-- Add push_token column to user_profiles table
-- This will store the Expo push token for each user

ALTER TABLE user_profiles 
ADD COLUMN push_token TEXT;

-- Add index for faster lookups
CREATE INDEX idx_user_profiles_push_token ON user_profiles(push_token);

-- Add comment to document the column
COMMENT ON COLUMN user_profiles.push_token IS 'Expo push token for sending push notifications to this user';
