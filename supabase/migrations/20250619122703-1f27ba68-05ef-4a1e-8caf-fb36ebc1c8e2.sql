
-- Update the instance status from 'initializing' to 'unauthorized' for the stuck user
-- This will allow QR code generation to work immediately
UPDATE profiles 
SET instance_status = 'unauthorized', 
    updated_at = now()
WHERE instance_status = 'initializing' 
  AND instance_id IS NOT NULL 
  AND whapi_token IS NOT NULL;
