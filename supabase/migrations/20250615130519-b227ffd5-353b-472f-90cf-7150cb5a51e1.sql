
-- הוספת עמודות חדשות לתמיכה במערכת trial של WHAPI
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS whapi_channel_id TEXT,
ADD COLUMN IF NOT EXISTS payment_plan TEXT DEFAULT 'trial';

-- עדכון ערכי ברירת מחדל עבור משתמשים קיימים
UPDATE public.profiles 
SET trial_expires_at = created_at + INTERVAL '3 days'
WHERE trial_expires_at IS NULL AND billing_status = 'trial';

-- הוספת index לביצועים טובים יותר בשאילתות cleanup
CREATE INDEX IF NOT EXISTS idx_profiles_trial_expires 
ON public.profiles(trial_expires_at) 
WHERE billing_status = 'trial';

-- הוספת constraint לוודא שתאריכי פקיעה הגיוניים
ALTER TABLE public.profiles 
ADD CONSTRAINT check_trial_expires_future 
CHECK (trial_expires_at IS NULL OR trial_expires_at > created_at);
