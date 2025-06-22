
-- Reset the user profile for gadigila@gmail.com to allow creating a new channel
UPDATE profiles 
SET 
  instance_id = NULL,
  whapi_token = NULL,
  instance_status = 'disconnected',
  updated_at = now()
WHERE id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'gadigila@gmail.com'
);
