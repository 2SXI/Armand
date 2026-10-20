-- ============================================================
-- ORDER TRACKING  (run once in Supabase → SQL Editor)
-- Lets a customer look up ONE order with the order number plus the
-- phone number used at checkout. Returns status and items only
-- (no address, no full phone). Wrong number or phone returns nothing.
-- ============================================================
CREATE OR REPLACE FUNCTION track_order(p_id BIGINT, p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o  orders%ROWTYPE;
  a  TEXT;
  b  TEXT;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  a := right(regexp_replace(coalesce(p_phone, ''),            '\D', '', 'g'), 9);
  b := right(regexp_replace(coalesce(o.customer_phone, ''),   '\D', '', 'g'), 9);
  IF length(a) < 7 OR a <> b THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id',             o.id,
    'status',         coalesce(o.status, 'pending'),
    'created_at',     o.created_at,
    'total',          o.total,
    'payment_method', o.payment_method,
    'mode',           CASE WHEN coalesce(o.notes, '') ILIKE '%DELIVERY requested%' THEN 'delivery' ELSE 'collection' END,
    'items',          coalesce((
        SELECT jsonb_agg(jsonb_build_object('name', i->>'name', 'qty', i->>'qty'))
        FROM jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) AS i
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION track_order(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION track_order(BIGINT, TEXT) TO anon, authenticated;
