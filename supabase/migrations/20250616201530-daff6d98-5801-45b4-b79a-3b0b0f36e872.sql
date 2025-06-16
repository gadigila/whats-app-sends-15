
-- יצירת טבלת קבוצות וואטסאפ
CREATE TABLE public.whatsapp_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  group_id TEXT NOT NULL, -- המזהה של הקבוצה מוואטסאפ (כמו 120363...)
  name TEXT NOT NULL,
  description TEXT,
  participants_count INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- וודא שאין כפילויות של אותה קבוצה לאותו משתמש
  UNIQUE(user_id, group_id)
);

-- הוספת אינדקסים לביצועים
CREATE INDEX idx_whatsapp_groups_user_id ON public.whatsapp_groups(user_id);
CREATE INDEX idx_whatsapp_groups_group_id ON public.whatsapp_groups(group_id);
CREATE INDEX idx_whatsapp_groups_last_synced ON public.whatsapp_groups(last_synced_at);

-- הגדרת RLS policies
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;

-- משתמשים יכולים לראות רק את הקבוצות שלהם
CREATE POLICY "Users can view their own groups" 
  ON public.whatsapp_groups 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- משתמשים יכולים ליצור קבוצות רק עבור עצמם
CREATE POLICY "Users can create their own groups" 
  ON public.whatsapp_groups 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- משתמשים יכולים לעדכן רק את הקבוצות שלהם
CREATE POLICY "Users can update their own groups" 
  ON public.whatsapp_groups 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- משתמשים יכולים למחוק רק את הקבוצות שלהם
CREATE POLICY "Users can delete their own groups" 
  ON public.whatsapp_groups 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- עדכון טבלת scheduled_messages לתמוך בקבוצות מהטבלה החדשה
-- נוסיף שדה נוסף group_names למקרה שנרצה להציג שמות
ALTER TABLE public.scheduled_messages 
ADD COLUMN IF NOT EXISTS group_names TEXT[],
ADD COLUMN IF NOT EXISTS total_groups INTEGER DEFAULT 0;

-- אינדקס על group_ids בטבלת scheduled_messages
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_group_ids 
ON public.scheduled_messages USING GIN(group_ids);
