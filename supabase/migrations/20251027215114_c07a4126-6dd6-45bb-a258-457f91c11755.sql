-- Add invoice tracking fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS last_invoice_number TEXT,
ADD COLUMN IF NOT EXISTS last_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS last_invoice_date TIMESTAMP WITH TIME ZONE;

-- Create invoices table for full history
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tranzila_invoice_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_url TEXT,
  pdf_url TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'ILS',
  plan_type TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(tranzila_invoice_id)
);

-- Enable RLS on invoices table
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Users can view their own invoices
CREATE POLICY "Users can view their own invoices"
  ON invoices FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage invoices (for edge functions)
CREATE POLICY "Service role can manage invoices"
  ON invoices FOR ALL
  USING (auth.role() = 'service_role');