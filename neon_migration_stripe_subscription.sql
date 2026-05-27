-- PayRisk AI: Stripe recurring subscription + anniversary billing period (idempotent).
-- Run in Neon SQL Editor after neon_migration_plans_usage.sql.

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_renewal_reminder_sent_at TIMESTAMPTZ;

-- period_start already exists from plans migration; for existing paid users without period_end,
-- set a 30-day window from period_start or today:
-- UPDATE users SET period_end = (COALESCE(period_start, CURRENT_DATE) + INTERVAL '1 month')::date
--   WHERE period_end IS NULL;
