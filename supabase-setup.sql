-- ============================================================
-- Armand Carpentry & Designs — Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================
--
-- AUTH MODEL (read this before running):
-- The storefront (index/products/product/trade/contact) uses the
-- public anon key and can only read ACTIVE products, INSERT
-- enquiries and place orders ONLY through the place_order() function
-- (section 7). It can never read customer data.
--
-- admin.html signs in with real Supabase Auth (email + password).
-- Every policy that touches orders, enquiries, inactive products,
-- or product writes requires `TO authenticated` — i.e. a valid
-- logged-in session — so the anon key alone can no longer read
-- other customers' orders or edit your catalog.
--
-- To create an admin login:
--   Supabase Dashboard → Authentication → Users → Add user
--   (set "Auto Confirm User" on so it can log in immediately)
-- Then sign in with that email/password at /admin.html.
--
-- NEVER put your service_role (secret) key in admin.html or any
-- other file that ships to the browser — it bypasses RLS entirely.
-- ============================================================

-- 1. PRODUCTS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT          NOT NULL,
  sku         TEXT,
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  old_price   NUMERIC(10,2),
  category    TEXT,
  description TEXT,
  image       TEXT,
  badge       TEXT,
  stock       INTEGER       DEFAULT 0,
  active      BOOLEAN       DEFAULT TRUE,
  featured    BOOLEAN       DEFAULT FALSE,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- If table already exists, add missing columns gracefully:
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured  BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active    BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge     TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS old_price NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku       TEXT;

-- 2. ORDERS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                BIGSERIAL PRIMARY KEY,
  customer_name     TEXT,
  customer_phone    TEXT,
  customer_address  TEXT,
  notes             TEXT,
  payment_method    TEXT,
  items             JSONB,
  total             NUMERIC(10,2),
  status            TEXT DEFAULT 'pending',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENQUIRIES TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiries (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT,
  phone      TEXT,
  email      TEXT,
  subject    TEXT,
  message    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ROW LEVEL SECURITY — PUBLIC READ ACCESS FOR PRODUCTS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

-- Public (unauthenticated, anon key) can read only ACTIVE products.
-- This is the only product-read policy the storefront needs.
DROP POLICY IF EXISTS "Public can read active products" ON products;
DROP POLICY IF EXISTS "Public can read all products" ON products;
CREATE POLICY "Public can read active products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (active = TRUE);

-- Signed-in admins (Supabase Auth users) can read every product,
-- including inactive/out-of-stock ones, for the admin dashboard.
DROP POLICY IF EXISTS "Authenticated can read all products" ON products;
CREATE POLICY "Authenticated can read all products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

-- Anyone (even unauthenticated shoppers) can place an order or submit
-- an enquiry — this is a write-only INSERT, so it can't leak data.
DROP POLICY IF EXISTS "Anyone can place orders" ON orders;
CREATE POLICY "Anyone can place orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can submit enquiries" ON enquiries;
CREATE POLICY "Anyone can submit enquiries"
  ON enquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only signed-in admins (created in Supabase Dashboard → Authentication
-- → Users, and logged into admin.html) can create/edit/delete products.
DROP POLICY IF EXISTS "Admin can manage products" ON products;
CREATE POLICY "Admin can manage products"
  ON products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only signed-in admins can read customer orders/enquiries (contains PII)
-- or update an order's status. This is what actually protects customer data.
DROP POLICY IF EXISTS "Admin can read orders" ON orders;
CREATE POLICY "Admin can read orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin can update orders" ON orders;
CREATE POLICY "Admin can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin can read enquiries" ON enquiries;
CREATE POLICY "Admin can read enquiries"
  ON enquiries FOR SELECT
  TO authenticated
  USING (true);

-- 5. STORAGE BUCKET FOR PRODUCT IMAGES
-- ─────────────────────────────────────────────────────────────
-- Run in: Supabase Dashboard → Storage → New Bucket
-- Bucket name: product-images
-- Public bucket: YES (enable public access)
--
-- Or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read of product images
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Only signed-in admins can upload/replace/delete product images.
DROP POLICY IF EXISTS "Anyone can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can manage product images" ON storage.objects;
CREATE POLICY "Admin can manage product images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

-- 6. SAMPLE FEATURED PRODUCT (optional — delete after testing)
-- ─────────────────────────────────────────────────────────────
-- INSERT INTO products (name, sku, price, category, description, badge, stock, active, featured)
-- VALUES ('Milano Bar Handle', 'BRC-HDL-042', 12.50, 'handles', '128mm centres · 304 Stainless Steel · Matt finish', 'new', 50, true, true)
-- ON CONFLICT DO NOTHING;


-- 7. ORDER INTEGRITY, STOCK AND ABUSE PROTECTION
-- ─────────────────────────────────────────────────────────────
-- The browser can no longer INSERT into orders directly. Orders go
-- through place_order(), which looks prices up from the products
-- table, checks and reserves stock, forces status = 'pending', and
-- rate-limits repeat submissions. Client-sent prices/totals/status
-- are ignored. Safe to re-run.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_restored BOOLEAN DEFAULT FALSE;

-- Remove the open insert policy: anon can no longer write orders directly.
DROP POLICY IF EXISTS "Anyone can place orders" ON orders;

CREATE OR REPLACE FUNCTION place_order(
  p_name    TEXT,
  p_phone   TEXT,
  p_address TEXT,
  p_notes   TEXT,
  p_method  TEXT,
  p_items   JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item     JSONB;
  v_prod     products%ROWTYPE;
  v_qty      INTEGER;
  v_total    NUMERIC(10,2) := 0;
  v_lines    JSONB := '[]'::JSONB;
  v_order_id BIGINT;
  v_name     TEXT := btrim(coalesce(p_name, ''));
  v_phone    TEXT := btrim(coalesce(p_phone, ''));
BEGIN
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Please enter a valid name.' USING ERRCODE = 'P0001';
  END IF;
  IF v_phone !~ '^[0-9+() -]{7,30}$' THEN
    RAISE EXCEPTION 'Please enter a valid phone number.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(coalesce(p_address, '')) > 300 OR char_length(coalesce(p_notes, '')) > 1000 THEN
    RAISE EXCEPTION 'Address or notes too long.' USING ERRCODE = 'P0001';
  END IF;
  IF p_method IS NULL OR p_method NOT IN
     ('EcoCash','OneMoney','Cash on Delivery','Bank Transfer / EFT','Paynow','PayPal') THEN
    RAISE EXCEPTION 'Invalid payment method.' USING ERRCODE = 'P0001';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Your cart is empty or invalid.' USING ERRCODE = 'P0001';
  END IF;

  -- Rate limit: max 5 orders per phone number per hour.
  IF (SELECT count(*) FROM orders
       WHERE customer_phone = v_phone
         AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Too many orders from this number. Please WhatsApp us instead.' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      v_qty := (v_item->>'qty')::INTEGER;
      SELECT * INTO v_prod FROM products
       WHERE id = (v_item->>'id')::BIGINT AND active = TRUE
       FOR UPDATE;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid item in cart.' USING ERRCODE = 'P0001';
    END;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product in your cart is no longer available.' USING ERRCODE = 'P0001';
    END IF;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 100 THEN
      RAISE EXCEPTION 'Invalid quantity for %.', v_prod.name USING ERRCODE = 'P0001';
    END IF;
    -- stock NULL = not tracked; 0 = out of stock (matches the storefront)
    IF v_prod.stock IS NOT NULL THEN
      IF v_prod.stock < v_qty THEN
        RAISE EXCEPTION 'Not enough stock for % (% left).', v_prod.name, v_prod.stock USING ERRCODE = 'P0001';
      END IF;
      UPDATE products SET stock = stock - v_qty WHERE id = v_prod.id;
    END IF;

    v_total := v_total + (v_prod.price * v_qty);
    v_lines := v_lines || jsonb_build_object(
      'id', v_prod.id, 'name', v_prod.name, 'price', v_prod.price,
      'qty', v_qty, 'image', v_prod.image);
  END LOOP;

  INSERT INTO orders (customer_name, customer_phone, customer_address, notes,
                      payment_method, items, total, status, payment_status)
  VALUES (v_name, v_phone, nullif(btrim(p_address), ''), nullif(btrim(p_notes), ''),
          p_method, v_lines, v_total, 'pending', 'unpaid')
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object('id', v_order_id, 'total', v_total, 'items', v_lines);
END;
$$;

REVOKE ALL ON FUNCTION place_order(TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_order(TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO anon, authenticated;

-- Restore reserved stock once when an order is cancelled.
CREATE OR REPLACE FUNCTION restore_stock_on_cancel() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_line JSONB;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled'
     AND NOT coalesce(NEW.stock_restored, FALSE) THEN
    FOR v_line IN SELECT * FROM jsonb_array_elements(coalesce(NEW.items, '[]'::JSONB)) LOOP
      UPDATE products SET stock = stock + (v_line->>'qty')::INTEGER
       WHERE id = (v_line->>'id')::BIGINT AND stock IS NOT NULL;
    END LOOP;
    NEW.stock_restored := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_stock_on_cancel ON orders;
CREATE TRIGGER trg_restore_stock_on_cancel
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION restore_stock_on_cancel();

-- Enquiries: server-side validation and rate limit (the anon insert
-- policy stays, but junk and floods are rejected).
CREATE OR REPLACE FUNCTION validate_enquiry() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.name    := btrim(coalesce(NEW.name, ''));
  NEW.phone   := btrim(coalesce(NEW.phone, ''));
  NEW.message := btrim(coalesce(NEW.message, ''));
  IF char_length(NEW.name) < 2 OR char_length(NEW.name) > 100
     OR char_length(NEW.phone) < 7 OR char_length(NEW.phone) > 30
     OR char_length(NEW.message) < 5 OR char_length(NEW.message) > 3000
     OR char_length(coalesce(NEW.email, '')) > 200
     OR char_length(coalesce(NEW.subject, '')) > 200 THEN
    RAISE EXCEPTION 'Invalid enquiry.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM enquiries
       WHERE phone = NEW.phone AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Too many enquiries. Please WhatsApp us instead.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_enquiry ON enquiries;
CREATE TRIGGER trg_validate_enquiry
  BEFORE INSERT ON enquiries
  FOR EACH ROW EXECUTE FUNCTION validate_enquiry();
