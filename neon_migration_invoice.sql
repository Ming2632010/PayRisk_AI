-- PayRisk AI: Add invoice template (users) and last_invoice_sent_at (customers). Idempotent.
-- Run this in the Neon SQL Editor if your schema was created before these columns.

ALTER TABLE users ADD COLUMN IF NOT EXISTS invoice_template JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_invoice_sent_at TIMESTAMPTZ;
