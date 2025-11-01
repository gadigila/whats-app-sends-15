-- Create table to track processed webhook events (prevents duplicate processing)
CREATE TABLE processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paypal_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_paypal_event_id ON processed_webhook_events(paypal_event_id);

-- Enable RLS (service role only)
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage webhook events"
ON processed_webhook_events
FOR ALL
TO service_role
USING (true);