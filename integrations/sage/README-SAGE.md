# Website orders → Sage (sales invoices)

Every new website order creates a **sales invoice** in Sage Business Cloud Accounting, with the
customer created once and re-used by phone number. One invoice per order, safe to retry.
Failed orders are listed in the `sage_failed_orders` view; nothing is lost and the website is never slowed down.

**Not included yet (next steps):** pulling stock/products from Sage, and sending payment status back to the website.

> This code was written and unit-tested for the invoice building, but it has **not** been run
> against a real Sage account. Do the test order in step 8 before relying on it.

## 0. Check first
- Sage's developer API must be available for your Sage account's country. Zimbabwe is not on every
  Sage product's country list. Confirm at https://developerselfservice.sageone.com that you can
  create an app and that your company can authorise it. If not, tell me which Sage product you use
  (Sage 50, Pastel, Evolution, Intelligence) and I will adapt this to an export or its own API.
- Invoices are created in the Sage company's currency. If Sage is in ZWG or ZAR but the website prices are in USD,
  the amounts will not match. Decide the currency before you go live.

## 1. Create the Sage app
1. Sign in at https://developerselfservice.sageone.com and create an app.
2. Callback URL: `https://<your-project>.supabase.co/functions/v1/sage-connect`
3. Note the **Client ID** and **Client Secret**.

## 2. Database
Run `sage-setup.sql` once in Supabase → SQL Editor.

## 3. Secrets (Supabase → Project Settings → Edge Functions → Secrets, or `supabase secrets set`)
```
SAGE_CLIENT_ID=...
SAGE_CLIENT_SECRET=...
SAGE_REDIRECT_URI=https://<your-project>.supabase.co/functions/v1/sage-connect
SAGE_WEBHOOK_SECRET=<make up a long random string>
SAGE_LEDGER_ACCOUNT_ID=      (filled in at step 6)
SAGE_TAX_RATE_ID=            (filled in at step 6)
```

## 4. Deploy (Supabase CLI, run in this folder)
```
supabase functions deploy sage-connect --no-verify-jwt
supabase functions deploy sage-lookup --no-verify-jwt
supabase functions deploy sage-sync-order --no-verify-jwt
```
(`--no-verify-jwt` because Sage and the database webhook cannot send a Supabase login; the
webhook secret protects the two private functions.)

## 5. Connect once
Open this link in your browser while logged in to Sage as the company admin (replace the two values):
```
https://www.sageone.com/oauth2/auth/central?filter=apiv3.1&response_type=code&client_id=<CLIENT_ID>&redirect_uri=<REDIRECT_URI, url-encoded>&scope=full_access&state=armand
```
Approve it. You should see "Sage is connected".

## 6. Find the two IDs invoices need
```
curl -H "x-webhook-secret: <SECRET>" "https://<project>.supabase.co/functions/v1/sage-lookup?what=ledger_accounts"
curl -H "x-webhook-secret: <SECRET>" "https://<project>.supabase.co/functions/v1/sage-lookup?what=tax_rates"
```
Pick the sales/income ledger account your accountant uses for product sales, and the correct tax rate
(or "No tax"). Put their ids in `SAGE_LEDGER_ACCOUNT_ID` and `SAGE_TAX_RATE_ID`.

## 7. Turn it on
Supabase → Database → Webhooks → Create: table `orders`, event **Insert**, type "Supabase Edge Functions" →
`sage-sync-order`, add header `x-webhook-secret: <SECRET>`.

## 8. Test
Place one small real order on the site. Within seconds:
- `sage_sync_log` shows `synced` with the Sage invoice id, and the invoice is in Sage with reference `WEB-<order number>`.
- Check the amounts and the tax with your accountant before going live.
- To retry a failed order: invoke `sage-sync-order` with `{"order_id": 123}` and the secret header.
