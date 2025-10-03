-- Enable required extensions for cron jobs and HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Create cron job to automatically set all connected users to offline every 3 minutes
-- This calls the existing whapi-check-status function with the set_all_offline action
SELECT cron.schedule(
  'set-all-users-offline-every-3min',
  '*/3 * * * *', -- Every 3 minutes
  $$
  SELECT
    net.http_post(
        url:='https://ifxvwettmgixfbivlzzl.supabase.co/functions/v1/whapi-check-status',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeHZ3ZXR0bWdpeGZiaXZsenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MzE0MDAsImV4cCI6MjA2NTQwNzQwMH0.mjmY61D9ZS3WKjpN1kgA1O0npFmXmXFHc4Q2WpyBi2Q"}'::jsonb,
        body:='{"action": "set_all_offline", "trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Verification queries (commented out, use these to manage the cron job):

-- Check if the cron job was created successfully:
-- SELECT * FROM cron.job WHERE jobname = 'set-all-users-offline-every-3min';

-- To manually trigger the cron job for testing:
-- SELECT
--   net.http_post(
--       url:='https://ifxvwettmgixfbivlzzl.supabase.co/functions/v1/whapi-check-status',
--       headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeHZ3ZXR0bWdpeGZiaXZsenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MzE0MDAsImV4cCI6MjA2NTQwNzQwMH0.mjmY61D9ZS3WKjpN1kgA1O0npFmXmXFHc4Q2WpyBi2Q"}'::jsonb,
--       body:='{"action": "set_all_offline", "trigger": "manual"}'::jsonb
--   ) as request_id;

-- To unschedule the cron job if needed:
-- SELECT cron.unschedule('set-all-users-offline-every-3min');