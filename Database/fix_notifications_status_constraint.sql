-- Fix notifications status constraint
-- Add proper check constraint for status values

-- First, drop the existing constraint if it exists
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_status_check;

-- Add the correct check constraint
ALTER TABLE notifications ADD CONSTRAINT notifications_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected', 'read', 'unread'));

-- Update any existing invalid status values
UPDATE notifications 
SET status = 'pending' 
WHERE status NOT IN ('pending', 'accepted', 'rejected', 'read', 'unread');
