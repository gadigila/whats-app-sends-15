
-- Delete all data for user gadigila@gmail.com to allow a fresh start
DO $$
DECLARE
    user_uuid uuid;
BEGIN
    -- Get the user ID first
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'gadigila@gmail.com';
    
    -- If user exists, delete all their data
    IF user_uuid IS NOT NULL THEN
        -- Delete scheduled messages
        DELETE FROM scheduled_messages WHERE user_id = user_uuid;
        
        -- Delete WhatsApp groups
        DELETE FROM whatsapp_groups WHERE user_id = user_uuid;
        
        -- Reset profile (keep the profile but clear WhatsApp data)
        UPDATE profiles 
        SET 
            instance_id = NULL,
            whapi_token = NULL,
            instance_status = 'disconnected',
            whapi_channel_id = NULL,
            updated_at = now()
        WHERE id = user_uuid;
        
        -- Log the cleanup
        RAISE NOTICE 'Cleaned up all data for user: %', user_uuid;
    ELSE
        RAISE NOTICE 'User gadigila@gmail.com not found';
    END IF;
END $$;
