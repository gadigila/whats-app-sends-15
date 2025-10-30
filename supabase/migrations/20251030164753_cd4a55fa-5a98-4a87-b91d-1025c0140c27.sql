-- Add tranzila_token column to profiles table for redundant payment token storage
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tranzila_token TEXT;

COMMENT ON COLUMN profiles.tranzila_token IS 'Tranzila card token (TranzilaTK) for redundant payment operations';