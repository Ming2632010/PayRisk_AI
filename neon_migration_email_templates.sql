-- PayRisk AI: Add reminder and offer email template columns to users. Idempotent.
-- Run this in the Neon SQL Editor so Email Settings (Email Templates) can be stored per user.

ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_template JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS offer_template JSONB DEFAULT '{}';
