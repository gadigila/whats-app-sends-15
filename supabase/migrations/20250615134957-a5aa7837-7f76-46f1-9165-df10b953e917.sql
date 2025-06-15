
-- יצירת Cron job שיפעיל את פונקציית הניקוי כל יום בחצות
SELECT cron.schedule(
  'cleanup-expired-trials-daily',
  '0 0 * * *', -- כל יום בחצות (00:00)
  $$
  SELECT
    net.http_post(
        url:='https://ifxvwettmgixfbivlzzl.supabase.co/functions/v1/cleanup-expired-trials',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeHZ3ZXR0bWdpeGZiaXZsenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MzE0MDAsImV4cCI6MjA2NTQwNzQwMH0.mjmY61D9ZS3WKjpN1kgA1O0npFmXmXFHc4Q2WpyBi2Q"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);
