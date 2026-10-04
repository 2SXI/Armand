-- ============================================================
-- Armand Carpentry & Designs — Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================
--
-- AUTH MODEL (read this before running):
-- The storefront (index/products/product/trade/contact) uses the
-- public anon key and can only read ACTIVE products and INSERT
-- orders/enquiries. It can never read customer data.
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
