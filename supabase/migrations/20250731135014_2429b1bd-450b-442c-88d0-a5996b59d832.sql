-- Create cron job to run background admin detection every 5 minutes
-- This processes groups in small batches to avoid overwhelming WHAPI
SELECT cron.schedule(
  'background-admin-detection',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://ifxvwettmgixfbivlzzl.supabase.co/functions/v1/detect-admin-groups',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeHZ3ZXR0bWdpeGZiaXZsenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MzE0MDAsImV4cCI6MjA2NTQwNzQwMH0.mjmY61D9ZS3WKjpN1kgA1O0npFmXmXFHc4Q2WpyBi2Q"}'::jsonb,
        body:='{"batchSize": 10, "trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Optional: Create a faster cron job during peak hours (every 2 minutes from 8 AM to 10 PM)
SELECT cron.schedule(
  'background-admin-detection-peak',
  '*/2 8-22 * * *', -- every 2 minutes between 8 AM and 10 PM
  $$
  SELECT
    net.http_post(
        url:='https://ifxvwettmgixfbivlzzl.supabase.co/functions/v1/detect-admin-groups',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeHZ3ZXR0bWdpeGZiaXZsenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MzE0MDAsImV4cCI6MjA2NTQwNzQwMH0.mjmY61D9ZS3WKjpN1kgA1O0npFmXmXFHc4Q2WpyBi2Q"}'::jsonb,
        body:='{"batchSize": 15, "trigger": "cron_peak"}'::jsonb
    ) as request_id;
  $$
);

-- Create index for efficient background processing
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_background_processing 
ON public.whatsapp_groups(admin_detection_status, created_at) 
WHERE admin_detection_status = 'pending';

-- Add a function to check background processing status for a user
CREATE OR REPLACE FUNCTION get_admin_detection_progress(user_uuid UUID)
RETURNS TABLE(
  total_groups INTEGER,
  pending_groups INTEGER,
  completed_groups INTEGER,
  failed_groups INTEGER,
  progress_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_groups,
    COUNT(*) FILTER (WHERE admin_detection_status = 'pending')::INTEGER as pending_groups,
    COUNT(*) FILTER (WHERE admin_detection_status = 'completed')::INTEGER as completed_groups,
    COUNT(*) FILTER (WHERE admin_detection_status = 'failed')::INTEGER as failed_groups,
    CASE 
      WHEN COUNT(*) = 0 THEN 0::NUMERIC
      ELSE ROUND((COUNT(*) FILTER (WHERE admin_detection_status = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
    END as progress_percentage
  FROM whatsapp_groups 
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;