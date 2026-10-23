-- Armand admin v5: append-only audit trail of admin actions.
-- Run once in the Supabase SQL editor (after supabase-accounts.sql, which defines is_admin()).
CREATE TABLE IF NOT EXISTS public.admin_audit (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor      TEXT,
  action     TEXT NOT NULL,
  detail     TEXT
);
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin reads audit"  ON public.admin_audit;
DROP POLICY IF EXISTS "Admin writes audit" ON public.admin_audit;
CREATE POLICY "Admin reads audit"  ON public.admin_audit FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admin writes audit" ON public.admin_audit FOR INSERT TO authenticated WITH CHECK (public.is_admin());
-- No UPDATE or DELETE policies on purpose: audit rows cannot be edited or removed from the app.
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON public.admin_audit (created_at DESC);
