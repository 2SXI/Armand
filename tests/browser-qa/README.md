# Browser QA (Playwright, Python)

These drive a real headless browser against the site served locally, with a fake Supabase
(stubbed REST responses and a stubbed supabase-js), so no live data is touched.

    pip install playwright && playwright install chromium
    python3 -m http.server 8765        # from the site folder, in another terminal
    python3 tests/browser-qa/crawl-all-pages.py   # every page, desktop + mobile: JS errors, 404s, overflow, broken images
    python3 tests/browser-qa/shop-flows.py        # product cards, product page, add to cart, home
    python3 tests/browser-qa/cart-flow.py         # add to cart + cart drawer
    python3 tests/browser-qa/admin-flows.py       # admin as a fake signed-in admin: every section, pager, sort, bulk bar, reports, audit

Expected result: no PAGEERR / ERR lines. (The shop-flows script prints one ADD FAIL when its
first sorted product is the out-of-stock one; use cart-flow.py for the real add-to-cart check.)
