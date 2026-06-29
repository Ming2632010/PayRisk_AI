-- Remembers which Stripe invoice last reset usage counters (one reset per paid invoice).
ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_reset_for_invoice_id TEXT;
