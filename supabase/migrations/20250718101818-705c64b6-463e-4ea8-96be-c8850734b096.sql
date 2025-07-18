
-- Add columns to profiles table for quiz responses
ALTER TABLE public.profiles 
ADD COLUMN community_type TEXT,
ADD COLUMN niches JSONB DEFAULT '[]'::jsonb,
ADD COLUMN group_count_range TEXT,
ADD COLUMN quiz_completed_at TIMESTAMP WITH TIME ZONE;

-- Update the is_onboarded column default to false if not already set
UPDATE public.profiles 
SET is_onboarded = false 
WHERE is_onboarded IS NULL;
