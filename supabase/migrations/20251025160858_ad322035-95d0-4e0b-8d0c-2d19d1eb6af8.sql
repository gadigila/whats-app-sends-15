-- Drop the existing status check constraint
ALTER TABLE scheduled_messages 
DROP CONSTRAINT IF EXISTS scheduled_messages_status_check;

-- Add new constraint with 'draft' and 'delivered' included
ALTER TABLE scheduled_messages 
ADD CONSTRAINT scheduled_messages_status_check 
CHECK (status IN ('pending', 'sent', 'failed', 'draft', 'delivered'));