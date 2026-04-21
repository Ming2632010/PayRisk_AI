-- PayRisk AI: SMS template + SMS sent trail on customers. Idempotent — safe to re-run.
-- Run in the Neon SQL Editor.

-- 1) Per-merchant SMS template body. One-way SMS, so just a body (no subject).
--    Stored as JSONB for consistency with reminder_template / offer_template.
ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_template JSONB DEFAULT '{}';

-- 2) Timestamp stamped whenever an SMS is sent to a customer, so merchants
--    have a visible audit trail on the customer row.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_sms_sent_at TIMESTAMPTZ;
