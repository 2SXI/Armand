// Finds the two Sage IDs invoices need (ledger account + tax rate).
// GET .../sage-lookup?what=ledger_accounts   or   ?what=tax_rates      (header: x-webhook-secret)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SAGE_API } from '../_shared/sage.ts';
import { getAccessToken } from '../_shared/token.ts';
// deno-lint-ignore no-explicit-any
declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('SAGE_WEBHOOK_SECRET')) return new Response('Forbidden', { status: 403 });
  const what = new URL(req.url).searchParams.get('what');
  if (!['ledger_accounts', 'tax_rates'].includes(what ?? '')) return new Response('Use ?what=ledger_accounts or ?what=tax_rates', { status: 400 });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { token, businessId } = await getAccessToken(sb);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (businessId) headers['X-Business'] = businessId;
  const r = await fetch(`${SAGE_API}/${what}?items_per_page=200`, { headers });
  const j = await r.json();
  // deno-lint-ignore no-explicit-any
  const rows = (j.$items ?? []).map((x: any) => ({ id: x.id, name: x.displayed_as ?? x.name, extra: x.ledger_account_type?.displayed_as ?? x.percentage }));
  return new Response(JSON.stringify(rows, null, 2), { headers: { 'Content-Type': 'application/json' } });
});
