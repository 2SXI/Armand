# Final Checks — Armand Carpentry & Designs

Run before every launch. Automated checks first, then the manual list.

## 1. Automated (run all four; all must say `0 failed`)
```
npm i jsdom
node tests/site-audit.mjs            # 762 checks across every page
node tests/frontend.test.mjs         # validation + account flows (31)
node tests/checkout-account.test.mjs # checkout + account menu (8)
node tests/account-ui.test.mjs       # new account dashboard features (16)
```
`site-audit.mjs` checks on every page: title, meta description, viewport, `lang`, one `<h1>`, image alt text,
label-to-input links, duplicate ids, `target="_blank"` has `rel="noopener"`, every local link/image/script/CSS file
exists, every `#anchor` exists, exactly one active nav item matching the page, no placeholder text, and that the
sitemap lists every public page.

## 2. Content (read each page once, out loud)
- [ ] Phone numbers match everywhere: +263 292 265 490 and 078 079 3585
- [ ] Email armandcarpentry@gmail.com, address 2142 Khami Rd, Iversens Complex, Bulawayo
- [ ] Trading hours: Mon–Fri 08:00–17:00, Sat 08:00–13:00
- [ ] Prices, stock and product photos correct in Supabase
- [ ] Legal page: shipping, returns, terms and privacy are the real policies
- [ ] Footer links "Shipping / Returns / Terms / Privacy" go to the right section of legal.html

## 3. Go-live configuration
- [ ] Supabase: run `supabase-setup.sql`, `supabase-track-order.sql`, `supabase-product-details.sql`, `supabase-accounts.sql`
- [ ] Supabase Auth: Site URL = https://armand.co.zw ; add https://armand.co.zw/account.html to Redirect URLs
- [ ] Supabase Auth: email confirmation on; custom SMTP set so reset emails reach inboxes
- [ ] Owner added to the `admins` table; admin.html sign-in tested
- [ ] Domain on HTTPS; `_headers` (Netlify) or `.htaccess` (Apache) active — check at securityheaders.com
- [ ] Payment methods tested end to end (EcoCash, Paynow, EFT/bank details, PayPal if enabled)
- [ ] Google Search Console: submit sitemap.xml
- [ ] Share a link in WhatsApp and check the preview card (og-card.png)

## 4. Account page (account.html)
- [ ] Sign in / Create account tabs switch by mouse and by ← → keys
- [ ] Show/Hide works on every password field; strength bar moves as you type
- [ ] Register: bad email/phone/weak password show inline red messages; valid form shows the confirmation notice
- [ ] Wrong password → "Incorrect email or password."
- [ ] Forgot password email arrives; link opens "Choose a new password"
- [ ] Signed in: avatar initial, email, order count, in-progress count and total are correct
- [ ] Order cards show the progress bar (pending → delivered); cancelled orders are marked and excluded from the total
- [ ] Change password works; sign out returns to sign-in
- [ ] Looks right at 360, 390, 768, 1366 and 1920 px

## 5. Speed, accessibility, browsers
- [ ] Lighthouse (mobile) on Home, Products, Account: Performance / Accessibility / Best Practices / SEO all 90+
- [ ] Keyboard only: skip link, menu, cart, forms all reachable with visible focus
- [ ] Chrome, Firefox, Edge, Safari (iPhone) — see TESTING.md grid
- [ ] 404 page shows for a wrong address

## Fixed in this pass
| Area | Problem found | Fix |
|---|---|---|
| Account page | Contact was highlighted in the menu instead of Account | Account is now the active item with `aria-current` |
| Account page | Plain single-column form, no brand presence | New two-panel layout, orange brand accents, benefit list, dashboard header, stats, order progress, change-password, show/hide password, strength bar |
| Account page | Styles mixed into the 90 KB `styles.css` | Moved to `account.css` |
| All pages | WhatsApp links opened a new tab without `rel="noopener"` | Added everywhere |
| 404 page | "Skip to main content" link pointed at nothing | Target added |
| Admin page | No meta description | Added |
| Sitemap | `track.html` missing | Added |
| Manifest | No `start_url` or description | Added |
