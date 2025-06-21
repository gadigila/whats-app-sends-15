
-- Reset the user profile to clean state
UPDATE profiles 
SET 
  instance_id = NULL,
  whapi_token = NULL,
  instance_status = 'disconnected',
  updated_at = now()
WHERE instance_id = 'DRSTRG-QGBKC';
