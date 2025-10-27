-- Add subscription management columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS tranzila_token TEXT,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failed_payment_attempts INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.subscription_status IS 'Values: none, active, cancelled, expired, grace_period';

-- Create index for efficient subscription renewal queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_renewal 
ON public.profiles(subscription_expires_at, auto_renew) 
WHERE subscription_status = 'active';

-- Create index for grace period monitoring
CREATE INDEX IF NOT EXISTS idx_profiles_grace_period 
ON public.profiles(grace_period_ends_at) 
WHERE subscription_status = 'grace_period';