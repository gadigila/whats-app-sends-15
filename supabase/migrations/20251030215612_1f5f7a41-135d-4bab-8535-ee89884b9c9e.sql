-- Add PayPal subscription fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'paypal' CHECK (payment_provider IN ('tranzila', 'paypal'));

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_paypal_subscription_id ON profiles(paypal_subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_payment_provider ON profiles(payment_provider);

-- Add comment for documentation
COMMENT ON COLUMN profiles.paypal_subscription_id IS 'PayPal subscription ID for recurring payments';
COMMENT ON COLUMN profiles.payment_provider IS 'Payment provider used: tranzila or paypal';