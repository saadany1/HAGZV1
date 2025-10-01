-- Match Reminders Migration
-- Add columns to track notification reminders for matches

-- Add columns to bookings table to track reminder notifications
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'friendly' CHECK (match_type IN ('friendly', 'ranked')),
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT TRUE;

-- Create index for efficient querying of upcoming matches that need reminders
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_lookup 
ON public.bookings(date, time, reminder_sent, notification_enabled) 
WHERE reminder_sent = FALSE AND notification_enabled = TRUE;

-- Create index for match type filtering
CREATE INDEX IF NOT EXISTS idx_bookings_match_type ON public.bookings(match_type);

-- Add comments to document the new columns
COMMENT ON COLUMN public.bookings.reminder_sent IS 'Whether a 2-hour reminder notification has been sent for this match';
COMMENT ON COLUMN public.bookings.reminder_sent_at IS 'Timestamp when the reminder notification was sent';
COMMENT ON COLUMN public.bookings.match_type IS 'Type of match: friendly or ranked';
COMMENT ON COLUMN public.bookings.notification_enabled IS 'Whether notifications are enabled for this match';

-- Create a function to get upcoming matches that need reminder notifications
CREATE OR REPLACE FUNCTION get_matches_needing_reminders()
RETURNS TABLE (
    booking_id uuid,
    pitch_name text,
    pitch_location text,
    match_date date,
    match_time time,
    match_type text,
    created_by uuid,
    max_players integer,
    is_public boolean,
    reminder_time timestamptz
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id as booking_id,
        b.pitch_name,
        b.pitch_location,
        b.date as match_date,
        b.time as match_time,
        b.match_type,
        b.created_by,
        b.max_players,
        b.is_public,
        (b.date + b.time - INTERVAL '2 hours') as reminder_time
    FROM public.bookings b
    WHERE 
        b.reminder_sent = FALSE
        AND b.notification_enabled = TRUE
        AND b.date >= CURRENT_DATE
        AND (b.date + b.time - INTERVAL '2 hours') <= NOW()
        AND (b.date + b.time) > NOW() -- Match hasn't started yet
    ORDER BY b.date, b.time;
END;
$$;

-- Create a function to mark reminder as sent
CREATE OR REPLACE FUNCTION mark_reminder_sent(booking_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.bookings 
    SET 
        reminder_sent = TRUE,
        reminder_sent_at = NOW()
    WHERE id = booking_uuid;
    
    RETURN FOUND;
END;
$$;

-- Create a function to get all participants for a match (including organizer and joined players)
CREATE OR REPLACE FUNCTION get_match_participants(booking_uuid uuid)
RETURNS TABLE (
    user_id uuid,
    push_token text,
    full_name text,
    email text
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    -- Get the match organizer
    SELECT 
        up.id as user_id,
        up.push_token,
        up.full_name,
        up.email
    FROM public.bookings b
    JOIN public.user_profiles up ON b.created_by = up.id
    WHERE b.id = booking_uuid AND up.push_token IS NOT NULL
    
    UNION
    
    -- Get all players who joined the match
    SELECT 
        up.id as user_id,
        up.push_token,
        up.full_name,
        up.email
    FROM public.booking_members bm
    JOIN public.user_profiles up ON bm.user_id = up.id
    WHERE bm.booking_id = booking_uuid 
        AND bm.status = 'confirmed'
        AND up.push_token IS NOT NULL;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_matches_needing_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION mark_reminder_sent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_match_participants(uuid) TO authenticated;
