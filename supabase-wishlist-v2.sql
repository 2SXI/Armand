-- Armand: account wishlist ("saved items") that follows the customer across devices.
-- Run once in the Supabase SQL editor, after supabase-accounts.sql (which defines is_admin()).
CREATE TABLE IF NOT EXISTS public.wishlist (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,   -- deleted with the account
  product_id TEXT NOT NULL CHECK (char_length(product_id) BETWEEN 1 AND 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS wishlist_product_idx ON public.wishlist (product_id);
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own wishlist read"   ON public.wishlist;
DROP POLICY IF EXISTS "Own wishlist add"    ON public.wishlist;
DROP POLICY IF EXISTS "Own wishlist remove" ON public.wishlist;
DROP POLICY IF EXISTS "Admin reads wishlist" ON public.wishlist;
CREATE POLICY "Own wishlist read"   ON public.wishlist FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own wishlist add"    ON public.wishlist FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own wishlist remove" ON public.wishlist FOR DELETE TO authenticated USING (user_id = auth.uid());
-- Admins can read everyone's saves for the "Most saved products" report (read-only).
CREATE POLICY "Admin reads wishlist" ON public.wishlist FOR SELECT TO authenticated USING (public.is_admin());

-- At most 300 saved items per customer.
CREATE OR REPLACE FUNCTION public.wishlist_cap() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.wishlist WHERE user_id = NEW.user_id) >= 300 THEN
    RAISE EXCEPTION 'Your saved items list is full (300 items).';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wishlist_cap_trg ON public.wishlist;
CREATE TRIGGER wishlist_cap_trg BEFORE INSERT ON public.wishlist FOR EACH ROW EXECUTE FUNCTION public.wishlist_cap();
