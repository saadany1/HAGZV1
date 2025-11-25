-- Push Notifications Database Migration
-- Run this in your Supabase SQL Editor

-- Migration 1: Add push_token to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Migration 2: Create notifications history table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type text,
  title text,
  message text,
  data jsonb,
  status text DEFAULT 'pending', -- pending | sent | failed
  created_at timestamptz DEFAULT now()
);

-- Migration 3: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_push_token ON public.user_profiles(push_token);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Migration 4: Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Migration 5: Create RLS policies for notifications
-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create notifications (for invitations)
CREATE POLICY "Users can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (true); -- Allow any authenticated user to create notifications

-- Users can update their own notifications (mark as read, etc.)
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Migration 6: Create function to get users with push tokens
CREATE OR REPLACE FUNCTION get_users_with_push_tokens()
RETURNS TABLE (
  user_id uuid,
  push_token text,
  username text,
  full_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id as user_id,
    up.push_token,
    up.username,
    up.full_name
  FROM user_profiles up
  WHERE up.push_token IS NOT NULL
    AND up.push_token != '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration 7: Create function to clean up invalid push tokens
CREATE OR REPLACE FUNCTION cleanup_invalid_push_tokens(invalid_tokens text[])
RETURNS void AS $$
BEGIN
  UPDATE user_profiles 
  SET push_token = NULL 
  WHERE push_token = ANY(invalid_tokens);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

