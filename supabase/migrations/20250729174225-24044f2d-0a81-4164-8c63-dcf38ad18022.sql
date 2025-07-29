-- Clean up stuck sync progress records that may confuse users
-- Only clean up records older than 1 hour that are still "starting"
DELETE FROM sync_progress 
WHERE status = 'starting' 
  AND started_at < NOW() - INTERVAL '1 hour';