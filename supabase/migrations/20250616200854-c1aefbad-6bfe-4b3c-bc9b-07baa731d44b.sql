
-- הסרת שדות כפולים וניקוי טבלת profiles
-- נשמור רק trial_expires_at (ונסיר trial_ends_at)
-- נשמור רק payment_plan (ונסיר billing_status שכן payment_plan יותר מתאים)

-- ראשית, נעדכן את כל הנתונים הקיימים כך שיהיו בשדות הנכונים
UPDATE public.profiles 
SET trial_expires_at = trial_ends_at 
WHERE trial_ends_at IS NOT NULL AND trial_expires_at IS NULL;

UPDATE public.profiles 
SET payment_plan = billing_status 
WHERE billing_status IS NOT NULL;

-- עכשיו נסיר את השדות הכפולים
ALTER TABLE public.profiles DROP COLUMN IF EXISTS trial_ends_at;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS billing_status;

-- נוסיף constraints לוודא עקביות הנתונים
ALTER TABLE public.profiles 
ADD CONSTRAINT check_payment_plan_values 
CHECK (payment_plan IN ('trial', 'expired', 'monthly', 'yearly'));

-- נוסיף index על trial_expires_at לביצועים טובים יותר
CREATE INDEX IF NOT EXISTS idx_profiles_trial_expires_active 
ON public.profiles(trial_expires_at) 
WHERE payment_plan = 'trial';

-- נוודא שיש ערכי ברירת מחדל נכונים
ALTER TABLE public.profiles 
ALTER COLUMN payment_plan SET DEFAULT 'trial',
ALTER COLUMN instance_status SET DEFAULT 'disconnected';
