-- ============================================================
-- SAGE LINK: database setup (run once in Supabase → SQL Editor)
-- These tables are private: RLS is on and there are NO policies,
-- so only the server functions (service role) can read or write.
-- ============================================================
CREATE TABLE IF NOT EXISTS sage_tokens (
  id            INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),   -- one row only
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  business_id   TEXT,
  locked_until  TIMESTAMPTZ,            -- stops two refreshes running at once
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sage_contacts (   -- website customer → Sage contact
  phone_key   TEXT PRIMARY KEY,              -- last 9 digits of the phone number
  contact_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sage_sync_log (   -- one row per order, so nothing is invoiced twice
  order_id         BIGINT PRIMARY KEY,
  status           TEXT NOT NULL DEFAULT 'pending',   -- pending | synced | failed
  sage_invoice_id  TEXT,
  sage_invoice_ref TEXT,
  attempts         INT NOT NULL DEFAULT 0,
  last_error       TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sage_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_sync_log  ENABLE ROW LEVEL SECURITY;
INSERT INTO sage_tokens (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Handy view for you (in the Supabase table editor): orders that did not reach Sage
CREATE OR REPLACE VIEW sage_failed_orders AS
  SELECT order_id, attempts, last_error, updated_at FROM sage_sync_log WHERE status = 'failed';
