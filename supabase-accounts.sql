-- ============================================================
-- CUSTOMER ACCOUNTS + ADMIN ROLE   (run once in Supabase → SQL Editor)
-- Safe to re-run.
--
-- !! RUN THIS BEFORE linking account.html from the live site !!
--
-- WHY: the original policies treat every signed-in user as an admin
-- (TO authenticated USING (true)). That was fine with one owner
-- account, but once customers can register, any customer would be
-- able to read every order and edit the catalogue. This file adds a
-- real admin role and re-points every admin policy at it.
--
-- What it does
--   1. admins table + is_admin() — only listed users are admins
--   2. every existing Supabase Auth user is made an admin (they were
--      all admins until now), so you are not locked out
--   3. all admin policies now require is_admin()
--   4. profiles table (name, phone), created automatically at sign-up
--   5. orders.user_id — links an order to the logged-in customer
--      (guest checkout still works, user_id is just NULL)
--   6. customers can read ONLY their own orders
--   7. CHECK constraints so bad data is rejected by the database
-- ============================================================

-- 1. ADMIN ROLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;   -- no policies: not readable from the browser
REVOKE ALL ON admins FROM anon, authenticated;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated;

-- 2. EXISTING USERS BECOME ADMINS (they were admins under the old rules)
INSERT INTO admins (user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;

-- 3. ADMIN POLICIES NOW REQUIRE is_admin() ───────────────────
DROP POLICY IF EXISTS "Authenticated can read all products" ON products;
DROP POLICY IF EXISTS "Admin can read all products" ON products;
CREATE POLICY "Admin can read all products" ON products
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admin can manage products" ON products;
CREATE POLICY "Admin can manage products" ON products
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can read orders" ON orders;
CREATE POLICY "Admin can read orders" ON orders
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admin can update orders" ON orders;
CREATE POLICY "Admin can update orders" ON orders
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can read enquiries" ON enquiries;
CREATE POLICY "Admin can read enquiries" ON enquiries
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admin can manage product images" ON storage.objects;
CREATE POLICY "Admin can manage product images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

-- 4. PROFILES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT CHECK (char_length(full_name) BETWEEN 2 AND 100),
  phone      TEXT CHECK (phone ~ '^[0-9+() -]{7,30}$'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own profile read" ON profiles;
CREATE POLICY "Own profile read" ON profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Own profile update" ON profiles;
CREATE POLICY "Own profile update" ON profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Create the profile row automatically when someone registers.
-- Bad metadata never blocks sign-up: invalid values are stored as NULL.
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name  TEXT := btrim(coalesce(NEW.raw_user_meta_data->>'full_name', ''));
  v_phone TEXT := btrim(coalesce(NEW.raw_user_meta_data->>'phone', ''));
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (
    NEW.id,
    CASE WHEN char_length(v_name) BETWEEN 2 AND 100 THEN v_name END,
    CASE WHEN v_phone ~ '^[0-9+() -]{7,30}$' THEN v_phone END
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5. LINK ORDERS TO CUSTOMERS ────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);

-- Stamp the logged-in customer on every new order. Done in a trigger so
-- the browser can never choose whose account an order belongs to, and
-- place_order() itself does not need to change. Guests get NULL.
CREATE OR REPLACE FUNCTION set_order_owner() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_order_owner ON orders;
CREATE TRIGGER trg_set_order_owner
  BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION set_order_owner();

-- 6. CUSTOMERS READ ONLY THEIR OWN ORDERS ────────────────────
DROP POLICY IF EXISTS "Customers read own orders" ON orders;
CREATE POLICY "Customers read own orders" ON orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 7. DATA-QUALITY CONSTRAINTS (NOT VALID = existing rows are not re-checked)
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_price_chk CHECK (price >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_stock_chk CHECK (stock IS NULL OR stock >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_name_chk CHECK (char_length(btrim(name)) BETWEEN 1 AND 200) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_total_chk CHECK (total IS NULL OR total >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_status_chk
    CHECK (status IN ('pending','confirmed','shipped','ready','collected','delivered','cancelled')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE enquiries ADD CONSTRAINT enquiries_email_chk
    CHECK (email IS NULL OR email = '' OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- AFTERWARDS, in Supabase → Authentication:
--   • Providers → Email → turn ON "Confirm email" (recommended) and
--     set the minimum password length to 8.
--   • URL Configuration → add your site URL so confirmation links work.
-- To make another person an admin:
--   INSERT INTO admins (user_id) SELECT id FROM auth.users WHERE email = 'them@example.com';
-- ============================================================
