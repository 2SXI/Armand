# Testing — Armand Carpentry & Designs

## 1. Automated tests (run, results recorded)

| Area | What was tested | Result |
|---|---|---|
| Validation rules | Email, phone (Zimbabwe formats), password strength, name, number ranges, text length | 10 / 10 pass |
| Registration | Empty form blocked; inline errors; `aria-invalid` + Bootstrap `is-invalid`; checkbox error placement; mismatched passwords; valid form calls `signUp` with name + phone; confirmation notice; bot honeypot; duplicate email message | 10 / 10 pass (Bootstrap tab switching tested with the real library) |
| Sign in / out | Empty form blocked; wrong password gives friendly message and clears the field; sign-out returns to sign-in | 4 / 4 pass |
| Account experience | Menu shows "Account" for guests and "Hi, Alice" when signed in; checkout shows a sign-in note for guests and prefills name/phone for customers; checkout rejects letters in the phone and one-letter names | 8 / 8 pass |
| My orders | Orders listed with number and total; empty state; hostile item name is escaped (no XSS); read-only email | 5 / 5 pass |
| **Database security (real PostgreSQL)** | See table below | all expected outcomes |

### Database security matrix (row-level security)

| # | Check | Expected | Result |
|---|---|---|---|
| T2 | A newly registered customer is not an admin | false | ✔ |
| T3/T4 | Profile row is created automatically; bad metadata does not block sign-up | stored / NULL | ✔ |
| T5–T7 | Customer, second customer and guest can all place an order | total 5.00 | ✔ |
| — | Order is stamped with the logged-in customer; guest order has no owner | by user / guest | ✔ |
| T8/T9 | Each customer sees only their own orders | 1 each | ✔ |
| T10 | Anonymous visitor sees no orders | 0 | ✔ |
| T11 | Admin sees all orders | 3 | ✔ |
| T12 | Customer cannot change order status or total | 0 rows | ✔ |
| T13 | Customer cannot insert an order row directly | RLS error | ✔ |
| T14–T19 | Customer sees only active products, cannot edit/delete/insert; admin can | as expected | ✔ |
| T20–T22 | Customer cannot read enquiries or the admins table, cannot make themselves admin | blocked | ✔ |
| T23–T25 | Customer can edit own profile, not anyone else's | as expected | ✔ |
| T26–T29 | Bad email, negative price and invalid order status rejected by the database | errors | ✔ |
| T27 | Guest enquiry (with and without email) accepted | inserted | ✔ |
| T31 | Admin status flow pending → confirmed → shipped → delivered | works | ✔ |
| T31b | Cancelling an order restores stock | 7 → 8 | ✔ |
| T32 | Guest order tracking by order number + phone | delivered / nothing for wrong phone | ✔ |
| — | Migration is safe to run repeatedly | 3 runs, no errors | ✔ |

Run the front-end tests with `node tests/frontend.test.mjs` and `node tests/checkout-account.test.mjs`.

Bug found by testing and fixed: the first version of the migration failed when run a second time (missing `DROP POLICY IF EXISTS`).

## 2. Manual cross-browser / responsive testing (to complete)

Open each page, tick when it looks and works correctly, and attach a screenshot.
Pages: Home, About, Products, Product, Portfolio, Trade, Contact, Track, Legal, My Account.

| Device / width | Chrome | Firefox | Edge | Safari | Notes |
|---|---|---|---|---|---|
| Phone 360 px | ☐ | ☐ | ☐ | ☐ | |
| Phone 414 px | ☐ | ☐ | ☐ | ☐ | |
| Tablet 768 px | ☐ | ☐ | ☐ | ☐ | |
| Laptop 1366 px | ☐ | ☐ | ☐ | ☐ | |
| Desktop 1920 px | ☐ | ☐ | ☐ | ☐ | |

## 3. Manual functional checklist (to complete)

| Test | Steps | Expected | Pass? |
|---|---|---|---|
| Register | My Account → Create account → valid details | Confirmation message; profile row appears in Supabase | ☐ |
| Register, invalid | Submit with bad email / weak password | Inline red messages, nothing sent | ☐ |
| Confirm email + sign in | Click link in email, sign in | My Account shows welcome + details | ☐ |
| Wrong password | Sign in with wrong password | "Incorrect email or password." | ☐ |
| Forgot password | Enter email, click Forgot password | Email arrives; link opens "Choose a new password" | ☐ |
| Place order while signed in | Add to cart → checkout | Order appears under My orders | ☐ |
| Place order as guest | Same, signed out | Works; found via Track Order | ☐ |
| Customer can't reach admin | Sign in to admin.html as a customer | "This account does not have admin access" | ☐ |
| Admin CRUD | Sign in as owner; add, edit, delete a product | Changes visible on Products page | ☐ |
| Contact form | Submit with bad phone, then valid | Error, then success; row in Supabase | ☐ |
| Keyboard only | Tab through sign-in and register | Visible focus; tabs work with ← → | ☐ |
| Screen reader | Submit empty register form | Errors announced | ☐ |
