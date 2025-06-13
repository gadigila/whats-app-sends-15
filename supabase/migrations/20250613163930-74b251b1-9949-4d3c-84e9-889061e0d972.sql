
-- Create scheduled_messages table
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  message TEXT NOT NULL,
  group_ids TEXT[] NOT NULL,
  media_url TEXT,
  send_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error_message TEXT
);

-- Create users profile table with WHAPI token
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  whapi_token TEXT,
  instance_id TEXT,
  trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '3 days'),
  plan TEXT DEFAULT 'free',
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  is_onboarded BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'user',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheduled_messages
CREATE POLICY "Users can view their own scheduled messages" 
  ON public.scheduled_messages 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled messages" 
  ON public.scheduled_messages 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled messages" 
  ON public.scheduled_messages 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled messages" 
  ON public.scheduled_messages 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add realtime functionality for scheduled_messages
ALTER TABLE public.scheduled_messages REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.scheduled_messages;
