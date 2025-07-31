-- Add admin detection columns to whatsapp_groups table
ALTER TABLE public.whatsapp_groups 
ADD COLUMN admin_detection_status TEXT DEFAULT 'pending',
ADD COLUMN admin_detection_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for better performance on admin detection queries
CREATE INDEX idx_whatsapp_groups_admin_detection_status 
ON public.whatsapp_groups(admin_detection_status, created_at);

-- Update existing groups to have pending status
UPDATE public.whatsapp_groups 
SET admin_detection_status = 'pending' 
WHERE admin_detection_status IS NULL;