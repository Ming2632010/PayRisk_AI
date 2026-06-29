-- Tracks which billing period usage counters belong to (resets on Stripe renewal).
ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_period_start DATE;
