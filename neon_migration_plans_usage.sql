-- PayRisk AI: Add plan and usage columns to users (idempotent).
-- Run this in the Neon SQL Editor if your users table was created without these columns.

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter';
ALTER TABLE users ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emails_sent_current_period INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_sent_current_period INTEGER DEFAULT 0;

-- Optional: set period_start for existing users who have NULL
-- UPDATE users SET period_start = date_trunc('month', current_date)::date WHERE period_start IS NULL;
