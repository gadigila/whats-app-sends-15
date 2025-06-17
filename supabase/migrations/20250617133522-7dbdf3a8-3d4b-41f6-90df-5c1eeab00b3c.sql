
-- Create the missing update_user_instance function
CREATE OR REPLACE FUNCTION public.update_user_instance(
  user_id UUID,
  new_instance_id TEXT,
  new_whapi_token TEXT,
  new_status TEXT,
  new_plan TEXT DEFAULT 'trial',
  new_trial_expires TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles 
  SET 
    instance_id = new_instance_id,
    whapi_token = new_whapi_token,
    instance_status = new_status,
    payment_plan = new_plan,
    trial_expires_at = new_trial_expires,
    updated_at = NOW()
  WHERE id = user_id;
  
  -- Ensure the update actually affected a row
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for user_id: %', user_id;
  END IF;
END;
$$;
