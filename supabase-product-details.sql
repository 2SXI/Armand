-- ============================================================
-- PRODUCT DETAILS (run once in Supabase → SQL Editor)
-- Adds optional fields shown on the product page. Existing products are unaffected.
--   features    one per line:  "Shiny finish: Glossy surface reflects light"
--   specs       one per line:  "Quantity per box: 17 tiles"
--   install_guide  steps, one per line, or a single video link
--   matching    SKUs of matching products, separated by commas or new lines
--   images      extra photo links, one per line (the main `image` is shown first)
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS features      TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS specs         TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS install_guide TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS matching      TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images        TEXT;
