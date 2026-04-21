-- PayRisk AI: invoices table, invoice counter, invoice email template, and transactions.invoiced_at.
-- Tax settings are stored as additional keys inside users.invoice_template (JSONB) so no schema
-- change is required for them. Run this in the Neon SQL Editor. Idempotent.

-- 1) Per-merchant invoice counter used to mint INV-0001, INV-0002, ...
ALTER TABLE users ADD COLUMN IF NOT EXISTS invoice_counter INTEGER DEFAULT 0;

-- 2) Per-merchant invoice email template (subject + intro body).
ALTER TABLE users ADD COLUMN IF NOT EXISTS invoice_email_template JSONB DEFAULT '{}';

-- 3) Flag on transactions: last time this transaction was included on a sent invoice.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

-- 3a) Per-line tax toggle. Defaults to TRUE so existing rows keep their tax behaviour
--     (tax applied at the user's configured rate). Set to FALSE for tax-exempt line
--     items (e.g. fresh food or other GST-free goods in Australia).
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS apply_tax BOOLEAN DEFAULT TRUE;

-- 4) Saved invoices. Each row is a full HTML snapshot of an invoice that was emailed,
--    so the merchant can reopen it at any time from the customer profile — even if the
--    underlying transactions are later edited or deleted.
CREATE TABLE IF NOT EXISTS invoices (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT        NOT NULL,
  customer_id       INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_number    TEXT        NOT NULL,
  subject           TEXT        DEFAULT '',
  transaction_ids   INTEGER[]   NOT NULL DEFAULT '{}',
  subtotal          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_label         TEXT        DEFAULT '',
  tax_rate          NUMERIC(6, 3) DEFAULT 0,
  tax_inclusive     BOOLEAN     DEFAULT FALSE,
  total             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sent_to           TEXT        DEFAULT '',
  html              TEXT        NOT NULL,
  sent_at           TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_number_uniq ON invoices (user_id, invoice_number);
CREATE INDEX IF NOT EXISTS invoices_customer_idx ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS invoices_user_idx ON invoices (user_id);
