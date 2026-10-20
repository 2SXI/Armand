// Called by a Database Webhook when a row is inserted into `orders` (or by hand: {"order_id": 123}).
// Creates the customer in Sage if needed, then a sales invoice. Safe to retry: one invoice per order.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SAGE_API, buildContact, buildInvoice, linesTotal, phoneKey, type Order } from '../_shared/sage.ts';
import { getAccessToken } from '../_shared/token.ts';
// deno-lint-ignore no-explicit-any
declare const Deno: any;

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('SAGE_WEBHOOK_SECRET')) return json({ error: 'forbidden' }, 403);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const body = await req.json().catch(() => ({}));
  const orderId: number | undefined = body?.record?.id ?? body?.order_id;
  if (!orderId) return json({ error: 'no order id' }, 400);

  const { data: log } = await sb.from('sage_sync_log').select('*').eq('order_id', orderId).maybeSingle();
  if (log?.status === 'synced') return json({ ok: true, already: log.sage_invoice_id });
  await sb.from('sage_sync_log').upsert({ order_id: orderId, status: 'pending', attempts: (log?.attempts ?? 0) + 1, updated_at: new Date().toISOString() });

  try {
    const { data: order, error } = await sb.from('orders').select('*').eq('id', orderId).single();
    if (error || !order) throw new Error('Order not found');
    const o = order as Order;
    if ((order as { status?: string }).status === 'cancelled') {
      await sb.from('sage_sync_log').update({ status: 'synced', last_error: 'skipped: cancelled' }).eq('order_id', orderId);
      return json({ ok: true, skipped: 'cancelled' });
    }

    const cfg = { ledgerId: Deno.env.get('SAGE_LEDGER_ACCOUNT_ID')!, taxRateId: Deno.env.get('SAGE_TAX_RATE_ID')! };
    if (!cfg.ledgerId || !cfg.taxRateId) throw new Error('SAGE_LEDGER_ACCOUNT_ID / SAGE_TAX_RATE_ID are not set');

    const { token, businessId } = await getAccessToken(sb);
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    if (businessId) headers['X-Business'] = businessId;

    // 1) the customer
    const key = phoneKey(o.customer_phone);
    let contactId: string | undefined;
    if (key) contactId = (await sb.from('sage_contacts').select('contact_id').eq('phone_key', key).maybeSingle()).data?.contact_id;
    if (!contactId) {
      const r = await fetch(`${SAGE_API}/contacts`, { method: 'POST', headers, body: JSON.stringify(buildContact(o)) });
      const j = await r.json();
      if (!r.ok) throw new Error(`Sage contact failed (${r.status}): ${JSON.stringify(j).slice(0, 400)}`);
      contactId = j.id;
      if (key) await sb.from('sage_contacts').upsert({ phone_key: key, contact_id: contactId });
    }

    // 2) the invoice
    const invoice = buildInvoice(o, contactId!, cfg);
    if (!invoice.sales_invoice.invoice_lines.length) throw new Error('Order has no items');
    const r = await fetch(`${SAGE_API}/sales_invoices`, { method: 'POST', headers, body: JSON.stringify(invoice) });
    const j = await r.json();
    if (!r.ok) throw new Error(`Sage invoice failed (${r.status}): ${JSON.stringify(j).slice(0, 400)}`);

    const mismatch = Math.abs(linesTotal(invoice) - Number(o.total ?? 0)) > 0.01;
    await sb.from('sage_sync_log').update({
      status: 'synced', sage_invoice_id: j.id, sage_invoice_ref: j.invoice_number ?? j.reference ?? null,
      last_error: mismatch ? `Check totals: website ${o.total}, lines ${linesTotal(invoice)}` : null, updated_at: new Date().toISOString(),
    }).eq('order_id', orderId);
    return json({ ok: true, invoice: j.id });
  } catch (e) {
    await sb.from('sage_sync_log').update({ status: 'failed', last_error: String((e as Error).message ?? e).slice(0, 800), updated_at: new Date().toISOString() }).eq('order_id', orderId);
    return json({ ok: false, error: String((e as Error).message ?? e) }, 500);
  }
});
