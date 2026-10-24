-- Armand security hardening v2.
-- Run once in the Supabase SQL editor, after supabase-accounts.sql and supabase-track-order.sql.
-- Adds: IP rate limiting (enquiries + order tracking), size limits on enquiries,
-- brute-force protection on track_order, and a self-service delete_my_account().

CREATE TABLE IF NOT EXISTS public.rate_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip TEXT NOT NULL, kind TEXT NOT NULL, ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_events_lookup ON public.rate_events (kind, ip, ts DESC);
ALTER TABLE public.rate_events ENABLE ROW LEVEL SECURITY;   -- no policies on purpose: only the functions below touch it

CREATE OR REPLACE FUNCTION public.client_ip() RETURNS TEXT
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT NULLIF(btrim(split_part(coalesce(
    (NULLIF(current_setting('request.headers', true), '')::json)->>'cf-connecting-ip',
    (NULLIF(current_setting('request.headers', true), '')::json)->>'x-forwarded-for', ''), ',', 1)), '')
$$;

CREATE OR REPLACE FUNCTION public.rate_limited(p_kind TEXT, p_max INT, p_window INTERVAL, p_record BOOLEAN DEFAULT TRUE)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ip TEXT := public.client_ip(); v_n INT;
BEGIN
  IF v_ip IS NULL THEN RETURN FALSE; END IF;
  IF random() < 0.02 THEN DELETE FROM public.rate_events WHERE ts < now() - interval '1 day'; END IF;
  SELECT count(*) INTO v_n FROM public.rate_events WHERE kind = p_kind AND ip = v_ip AND ts > now() - p_window;
  IF v_n >= p_max THEN RETURN TRUE; END IF;
  IF p_record THEN INSERT INTO public.rate_events (ip, kind) VALUES (v_ip, p_kind); END IF;
  RETURN FALSE;
END $$;
REVOKE ALL ON FUNCTION public.rate_limited(TEXT, INT, INTERVAL, BOOLEAN) FROM PUBLIC;

-- Enquiries: bounded sizes + at most 5 per hour per visitor
ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_len;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_len CHECK (
  char_length(coalesce(name,''))    <= 120 AND char_length(coalesce(phone,''))   <= 40  AND
  char_length(coalesce(email,''))   <= 160 AND char_length(coalesce(subject,'')) <= 200 AND
  char_length(coalesce(message,'')) <= 4000) NOT VALID;
CREATE OR REPLACE FUNCTION public.enquiries_guard() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.rate_limited('enquiry', 5, interval '1 hour') THEN
    RAISE EXCEPTION 'Too many enquiries. Please try again later.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enquiries_guard_trg ON public.enquiries;
CREATE TRIGGER enquiries_guard_trg BEFORE INSERT ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.enquiries_guard();

-- Order tracking: same answer as before, but 20 failed lookups per 15 minutes locks that visitor out
CREATE OR REPLACE FUNCTION public.track_order(p_id BIGINT, p_phone TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; a TEXT; b TEXT;
BEGIN
  IF public.rate_limited('track', 20, interval '15 minutes', FALSE) THEN RETURN NULL; END IF;
  SELECT * INTO o FROM orders WHERE id = p_id;
  IF NOT FOUND THEN PERFORM public.rate_limited('track', 20, interval '15 minutes'); RETURN NULL; END IF;
  a := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9);
  b := right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 9);
  IF length(a) < 7 OR a <> b THEN PERFORM public.rate_limited('track', 20, interval '15 minutes'); RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', o.id, 'status', coalesce(o.status, 'pending'), 'created_at', o.created_at,
    'total', o.total, 'payment_method', o.payment_method,
    'mode', CASE WHEN coalesce(o.notes, '') ILIKE '%DELIVERY requested%' THEN 'delivery' ELSE 'collection' END,
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('name', i->>'name', 'qty', i->>'qty'))
                       FROM jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) AS i), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.track_order(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order(BIGINT, TEXT) TO anon, authenticated;

-- Self-service account deletion (customers only). Orders are kept for the shop's records, unlinked from the person.
CREATE OR REPLACE FUNCTION public.delete_my_account() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v UUID := auth.uid();
BEGIN
  IF v IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF public.is_admin() THEN RAISE EXCEPTION 'Admin accounts cannot be deleted here'; END IF;
  UPDATE public.orders SET user_id = NULL WHERE user_id = v;
  DELETE FROM auth.users WHERE id = v;      -- profile row is removed by its cascade
END $$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
