-- Add tranzila_sto_id column to profiles table to store Standing Order ID
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tranzila_sto_id INTEGER;