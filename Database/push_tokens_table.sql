-- Push Tokens Table for Expo Push Notifications
-- This table stores Expo push tokens for users to enable push notifications

-- Create the push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_id TEXT,
    platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Ensure one token per user per device
    UNIQUE(user_id, device_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = TRUE;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_push_tokens_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_push_tokens_updated_at();

-- Row Level Security (RLS) policies
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own tokens
CREATE POLICY "Users can view their own push tokens" ON push_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens" ON push_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens" ON push_tokens
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens" ON push_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Admin policy for adelsaadany1@gmail.com to manage all tokens
CREATE POLICY "Admin can manage all push tokens" ON push_tokens
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.email = 'adelsaadany1@gmail.com'
        )
    );

-- Function to clean up old/inactive tokens
CREATE OR REPLACE FUNCTION cleanup_old_push_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete tokens that haven't been used in 30 days
    DELETE FROM push_tokens 
    WHERE last_used_at < NOW() - INTERVAL '30 days'
    OR (is_active = FALSE AND updated_at < NOW() - INTERVAL '7 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upsert push token (insert or update if exists)
CREATE OR REPLACE FUNCTION upsert_push_token(
    p_user_id UUID,
    p_token TEXT,
    p_device_id TEXT DEFAULT NULL,
    p_platform TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    token_id UUID;
BEGIN
    -- Insert or update the token
    INSERT INTO push_tokens (user_id, token, device_id, platform, last_used_at)
    VALUES (p_user_id, p_token, p_device_id, p_platform, NOW())
    ON CONFLICT (user_id, device_id)
    DO UPDATE SET 
        token = EXCLUDED.token,
        platform = EXCLUDED.platform,
        last_used_at = NOW(),
        is_active = TRUE,
        updated_at = NOW()
    RETURNING id INTO token_id;
    
    RETURN token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active tokens for a user
CREATE OR REPLACE FUNCTION get_user_push_tokens(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    token TEXT,
    device_id TEXT,
    platform TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.id,
        pt.token,
        pt.device_id,
        pt.platform,
        pt.created_at,
        pt.last_used_at
    FROM push_tokens pt
    WHERE pt.user_id = p_user_id 
    AND pt.is_active = TRUE
    ORDER BY pt.last_used_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all active tokens (admin only)
CREATE OR REPLACE FUNCTION get_all_active_push_tokens()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    user_email TEXT,
    token TEXT,
    device_id TEXT,
    platform TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND auth.users.email = 'adelsaadany1@gmail.com'
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    RETURN QUERY
    SELECT 
        pt.id,
        pt.user_id,
        au.email as user_email,
        pt.token,
        pt.device_id,
        pt.platform,
        pt.created_at,
        pt.last_used_at
    FROM push_tokens pt
    JOIN auth.users au ON pt.user_id = au.id
    WHERE pt.is_active = TRUE
    ORDER BY pt.last_used_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send test notification (admin only)
CREATE OR REPLACE FUNCTION send_test_notification(
    p_target_user_id UUID DEFAULT NULL,
    p_title TEXT DEFAULT 'Test Notification',
    p_body TEXT DEFAULT 'This is a test notification from HagzApp admin panel.',
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    token_id UUID,
    user_email TEXT,
    token TEXT,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    token_record RECORD;
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND auth.users.email = 'adelsaadany1@gmail.com'
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- If target_user_id is provided, get tokens for that user only
    -- Otherwise, get all active tokens
    FOR token_record IN
        SELECT 
            pt.id,
            au.email,
            pt.token
        FROM push_tokens pt
        JOIN auth.users au ON pt.user_id = au.id
        WHERE pt.is_active = TRUE
        AND (p_target_user_id IS NULL OR pt.user_id = p_target_user_id)
        ORDER BY pt.last_used_at DESC
    LOOP
        -- Return token info for the client to handle the actual push notification
        -- (Supabase functions can't make HTTP requests to Expo's push service directly)
        RETURN QUERY SELECT 
            token_record.id,
            token_record.email,
            token_record.token,
            TRUE as success,
            'Token ready for push notification' as message;
    END LOOP;
    
    -- If no tokens found
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            NULL::UUID as token_id,
            ''::TEXT as user_email,
            ''::TEXT as token,
            FALSE as success,
            'No active push tokens found' as message;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON push_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_push_token TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_push_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_active_push_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION send_test_notification TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_push_tokens TO authenticated;

-- Comment on table and functions
COMMENT ON TABLE push_tokens IS 'Stores Expo push notification tokens for users';
COMMENT ON FUNCTION upsert_push_token IS 'Insert or update a push token for a user';
COMMENT ON FUNCTION get_user_push_tokens IS 'Get all active push tokens for a specific user';
COMMENT ON FUNCTION get_all_active_push_tokens IS 'Admin function to get all active push tokens';
COMMENT ON FUNCTION send_test_notification IS 'Admin function to prepare test notifications';
COMMENT ON FUNCTION cleanup_old_push_tokens IS 'Clean up old and inactive push tokens';


