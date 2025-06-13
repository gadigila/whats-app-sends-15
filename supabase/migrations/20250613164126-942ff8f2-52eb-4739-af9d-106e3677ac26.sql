
-- Create cron job to run WhatsApp scheduler every minute
SELECT cron.schedule(
  'whatsapp-scheduler-job',
  '* * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url:='https://ifxvwettmgixfbivlzzl.supabase.co/functions/v1/whatsapp-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeHZ3ZXR0bWdpeGZiaXZsenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MzE0MDAsImV4cCI6MjA2NTQwNzQwMH0.mjmY61D9ZS3WKjpN1kgA1O0npFmXmXFHc4Q2WpyBi2Q"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);
