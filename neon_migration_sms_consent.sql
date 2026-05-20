-- PayRisk AI: merchant-confirmed SMS consent per customer. Idempotent — safe to re-run.
-- Run in the Neon SQL Editor.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ;
