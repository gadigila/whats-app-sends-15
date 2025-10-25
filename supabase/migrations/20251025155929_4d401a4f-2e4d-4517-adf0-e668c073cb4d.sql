-- Add draft support to scheduled_messages table
ALTER TABLE scheduled_messages 
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

-- Make send_at nullable to support drafts
ALTER TABLE scheduled_messages 
ALTER COLUMN send_at DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN scheduled_messages.is_draft IS 'Indicates if this is a draft message (true) or a scheduled/sent message (false)';
COMMENT ON COLUMN scheduled_messages.send_at IS 'When the message should be sent. NULL for draft messages.';