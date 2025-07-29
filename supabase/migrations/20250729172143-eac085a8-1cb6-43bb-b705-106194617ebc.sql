-- Create table for all user groups (fetched from WhatsApp for selection)
CREATE TABLE public.all_user_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  participants_count INTEGER DEFAULT 0,
  last_fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, group_id)
);

-- Create table for user selected groups (their chosen groups for messaging)
CREATE TABLE public.user_selected_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  participants_count INTEGER DEFAULT 0,
  selected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_refreshed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, group_id)
);

-- Enable RLS
ALTER TABLE public.all_user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_selected_groups ENABLE ROW LEVEL SECURITY;

-- Create policies for all_user_groups
CREATE POLICY "Users can view their own groups" 
ON public.all_user_groups 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own groups" 
ON public.all_user_groups 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own groups" 
ON public.all_user_groups 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own groups" 
ON public.all_user_groups 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for user_selected_groups
CREATE POLICY "Users can view their own selected groups" 
ON public.user_selected_groups 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own selected groups" 
ON public.user_selected_groups 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own selected groups" 
ON public.user_selected_groups 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own selected groups" 
ON public.user_selected_groups 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_all_user_groups_updated_at
BEFORE UPDATE ON public.all_user_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_selected_groups_updated_at
BEFORE UPDATE ON public.user_selected_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();