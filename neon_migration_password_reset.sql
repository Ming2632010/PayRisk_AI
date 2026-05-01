-- PayRisk AI: password reset tokens (forgot-password flow). Idempotent.
-- Run in the Neon SQL Editor.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT        NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_hash_idx
  ON password_reset_tokens (token_hash);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens (user_id);
