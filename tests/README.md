# Running the automated tests

**Front end** (validation + account page, simulated browser, fake Supabase):
```
npm i jsdom
node tests/frontend.test.mjs
```

**Database security** (needs a local PostgreSQL; stubs Supabase's `auth` and `storage`):
```
createdb t
psql -d t -f tests/supabase-stub.sql
psql -d t -f supabase-setup.sql -f supabase-track-order.sql -f supabase-product-details.sql
psql -d t -f supabase-accounts.sql
# add two test customers and two products, then:
psql -d t -f tests/security-rls.test.sql
```
