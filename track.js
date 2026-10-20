/* Order tracking: looks an order up with its number and the checkout phone number */
(function () {
  'use strict';
  const URL_ = 'https://nasbxjharopveynnwgrg.supabase.co', KEY = 'sb_publishable_io0oLODozq0xdUJiNT37tQ_u2PWURX0';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const STEPS = {
    collection: [['pending','Order received','We have your order and will confirm stock with you.'],
                 ['confirmed','Confirmed','Stock confirmed. We are preparing your order.'],
                 ['shipped','Ready for collection','Your order is ready at 2142 Khami Rd, Iversens Complex.'],
                 ['delivered','Collected','Thank you for shopping with Armand.']],
    delivery:   [['pending','Order received','We have your order and will confirm stock and delivery with you.'],
                 ['confirmed','Confirmed','Stock and delivery confirmed. We are preparing your order.'],
                 ['shipped','On its way','Your order has been dispatched.'],
                 ['delivered','Delivered','Thank you for shopping with Armand.']],
  };

  function show(o) {
    const steps = STEPS[o.mode] || STEPS.collection;
    const cancelled = o.status === 'cancelled';
    const at = Math.max(0, steps.findIndex(s => s[0] === o.status));
    const when = o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '';
    const items = (o.items || []).map(i => `<li><span>${esc(i.name)}</span><b>× ${esc(i.qty)}</b></li>`).join('');
    $('trkRes').innerHTML = `
      <div class="trk-head"><div><span class="trk-k">Order</span><h2>#${esc(o.id)}</h2></div><div><span class="trk-k">Placed</span><p>${esc(when)}</p></div>
        <div><span class="trk-k">Total</span><p>USD ${Number(o.total || 0).toFixed(2)}</p></div><div><span class="trk-k">Payment</span><p>${esc(o.payment_method || '')}</p></div></div>
      ${cancelled ? '<div class="trk-cancel"><b>This order was cancelled.</b> If you did not expect this, message us on WhatsApp.</div>' :
      `<ol class="trk-steps">${steps.map((s, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><i>${i < at ? '✓' : i + 1}</i><div><b>${s[1]}</b><span>${s[2]}</span></div></li>`).join('')}</ol>`}
      ${items ? `<h3>Items</h3><ul class="trk-items">${items}</ul>` : ''}`;
    $('trkRes').hidden = false;
  }

  async function lookup(id, phone) {
    const r = await fetch(`${URL_}/rest/v1/rpc/track_order`, {
      method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: Number(id), p_phone: phone }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const q = new URLSearchParams(location.search).get('order'); if (q) $('trkId').value = q.replace(/\D/g, '');
    $('trkForm').addEventListener('submit', async e => {
      e.preventDefault();
      const id = $('trkId').value.replace(/\D/g, ''), phone = $('trkPhone').value.trim(), err = $('trkErr'), btn = $('trkBtn');
      err.hidden = true; $('trkRes').hidden = true;
      if (!id || phone.replace(/\D/g, '').length < 7) { err.textContent = 'Enter your order number and the phone number you used at checkout.'; err.hidden = false; return; }
      btn.disabled = true; btn.textContent = 'Searching…';
      try {
        const o = await lookup(id, phone);
        if (!o) { err.textContent = 'We could not find an order with those details. Check the number and phone, or message us on WhatsApp.'; err.hidden = false; }
        else show(o);
      } catch (x) { console.error('[track]', x); err.textContent = 'Something went wrong. Please try again, or message us on WhatsApp.'; err.hidden = false; }
      btn.disabled = false; btn.textContent = 'Find my order';
    });
  });
})();
