
-- Delete all data for user gadigila@gmail.com and reset for fresh testing
-- User ID: 226a07a6-c5b7-4f4e-938b-30e09449b811

-- Clear all user data from all tables
DELETE FROM scheduled_messages WHERE user_id = '226a07a6-c5b7-4f4e-938b-30e09449b811';
DELETE FROM whatsapp_groups WHERE user_id = '226a07a6-c5b7-4f4e-938b-30e09449b811';
DELETE FROM segments WHERE user_id = '226a07a6-c5b7-4f4e-938b-30e09449b811';
DELETE FROM all_user_groups WHERE user_id = '226a07a6-c5b7-4f4e-938b-30e09449b811';
DELETE FROM user_selected_groups WHERE user_id = '226a07a6-c5b7-4f4e-938b-30e09449b811';
DELETE FROM sync_progress WHERE user_id = '226a07a6-c5b7-4f4e-938b-30e09449b811';

-- Reset the profile to fresh state (not onboarded)
UPDATE profiles 
SET 
  is_onboarded = false,
  quiz_completed_at = null,
  community_type = null,
  niches = '[]'::jsonb,
  group_count_range = null,
  instance_id = null,
  whapi_token = null,
  instance_status = 'disconnected',
  whapi_channel_id = null,
  payment_plan = 'trial',
  trial_expires_at = (now() + interval '3 days'),
  user_phone = null,
  phone_number = null,
  phone_detected_at = null,
  updated_at = now()
WHERE id = '226a07a6-c5b7-4f4e-938b-30e09449b811';
