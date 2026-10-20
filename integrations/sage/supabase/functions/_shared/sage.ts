// Shared helpers: pure functions (easy to test) + constants.
// deno-lint-ignore no-explicit-any
declare const Deno: any;

export const SAGE_API = (typeof Deno !== 'undefined' && Deno.env?.get('SAGE_API_BASE')) || 'https://api.accounting.sage.com/v3.1';
export const SAGE_TOKEN_URL = 'https://oauth.accounting.sage.com/token';

export const phoneKey = (phone: string | null | undefined) =>
  String(phone ?? '').replace(/\D/g, '').slice(-9);

export type Order = {
  id: number; customer_name: string | null; customer_phone: string | null; customer_address: string | null;
  notes: string | null; payment_method: string | null; total: number | string | null; created_at?: string;
  items: Array<{ id?: string | number; name?: string; qty?: number | string; price?: number | string }> | null;
};

export function buildContact(o: Order) {
  const name = (o.customer_name ?? '').trim() || `Web customer ${phoneKey(o.customer_phone)}`;
  return {
    contact: {
      name,
      contact_type_ids: ['CUSTOMER'],
      reference: `WEB-${phoneKey(o.customer_phone)}`.slice(0, 20),
      telephone: o.customer_phone ?? undefined,
    },
  };
}

export function buildInvoice(o: Order, contactId: string, cfg: { ledgerId: string; taxRateId: string }) {
  const lines = (o.items ?? []).map((i) => ({
    description: String(i.name ?? `Item ${i.id ?? ''}`).slice(0, 200),
    ledger_account_id: cfg.ledgerId,
    quantity: Number(i.qty ?? 1),
    unit_price: Number(i.price ?? 0),
    tax_rate_id: cfg.taxRateId,
  }));
  const delivery = /DELIVERY requested/i.test(o.notes ?? '') ? 'Delivery' : 'Collection';
  const date = (o.created_at ? new Date(o.created_at) : new Date()).toISOString().slice(0, 10);
  return {
    sales_invoice: {
      contact_id: contactId,
      date,
      reference: `WEB-${o.id}`,
      notes: `Website order #${o.id}. ${delivery}. Payment: ${o.payment_method ?? 'n/a'}.` +
             (o.customer_address ? ` Address: ${o.customer_address}.` : ''),
      invoice_lines: lines,
    },
  };
}

/** What the invoice lines add up to, to compare with the website total. */
export const linesTotal = (inv: ReturnType<typeof buildInvoice>) =>
  inv.sales_invoice.invoice_lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
