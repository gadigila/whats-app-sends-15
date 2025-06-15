
-- Add missing columns to profiles table for billing and WhatsApp integration
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS instance_id TEXT,
ADD COLUMN IF NOT EXISTS instance_status TEXT DEFAULT 'disconnected';

-- Update existing profiles to have default values
UPDATE public.profiles 
SET billing_status = 'trial' 
WHERE billing_status IS NULL;

UPDATE public.profiles 
SET instance_status = 'disconnected' 
WHERE instance_status IS NULL;
