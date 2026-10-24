import { JSDOM } from 'jsdom';
import fs from 'fs';
const S = new URL('../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const tick = () => new Promise(r => setTimeout(r, 30));
const submit = (w, id) => w.document.getElementById(id).dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
function page(fake) {
  const html = fs.readFileSync(S + 'account.html', 'utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
  const w = new JSDOM(html, { runScripts: 'outside-only', url: 'https://armand.co.zw/account.html' }).window;
  w.getSB = () => fake;
  for (const f of ['bootstrap.bundle.min.js', 'validate.js', 'account.js']) w.eval(fs.readFileSync(S + f, 'utf8'));
  return w;
}
const orders = [
  { id: 101, created_at: '2026-10-01T10:00:00Z', status: 'shipped', total: 40, payment_method: 'EcoCash', items: [{ name: 'Hinge', qty: 4 }] },
  { id: 102, created_at: '2026-10-05T10:00:00Z', status: 'delivered', total: 10.5, payment_method: 'EFT', items: [{ name: 'Handle', qty: 1 }] },
  { id: 103, created_at: '2026-10-06T10:00:00Z', status: 'cancelled', total: 99, payment_method: 'EFT', items: [] },
];
let updated = null;
const fake = (list, session = { user: { id: 'u1', email: 'alice@x.com', user_metadata: {} } }) => ({
  auth: { getSession: async () => ({ data: { session } }), onAuthStateChange() {}, signOut: async () => {}, signInWithPassword: async () => ({ data: {}, error: null }),
    updateUser: async a => { updated = a; return { error: null }; } },
  from() { return { select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return Promise.resolve({ data: list, error: null }); },
    maybeSingle: async () => ({ data: { full_name: 'Alice Moyo', phone: '+263781112222' } }), update() { return this; } }; },
});

{ // show/hide password
  const w = page(fake([], null)); await tick();
  const b = w.document.querySelector('[data-toggle-pw="log-pass"]'), i = w.document.getElementById('log-pass');
  b.click();
  ok(i.type === 'text' && b.getAttribute('aria-pressed') === 'true' && b.textContent === 'Hide', 'password: Show reveals the field and updates aria-pressed');
  b.click();
  ok(i.type === 'password' && b.getAttribute('aria-label') === 'Show password', 'password: Hide masks it again');
}
{ // strength meter
  const w = page(fake([], null)); await tick();
  const p = w.document.getElementById('reg-pass'), bar = w.document.getElementById('pwBar');
  p.value = ''; p.dispatchEvent(new w.Event('input'));
  ok(bar.style.width === '0%', 'meter: empty password shows no bar');
  p.value = 'abcdefg1'; p.dispatchEvent(new w.Event('input'));
  const weak = parseInt(bar.style.width);
  p.value = 'Abcdefghij1!x'; p.dispatchEvent(new w.Event('input'));
  ok(parseInt(bar.style.width) > weak && parseInt(bar.style.width) === 100, 'meter: longer, mixed password fills the bar');
}
{ // dashboard
  const w = page(fake(orders)); await tick(); await tick();
  const t = id => w.document.getElementById(id).textContent;
  ok(t('stOrders') === '3', 'stats: order count');
  ok(t('stOpen') === '1', 'stats: only pending/confirmed/shipped counted as in progress');
  ok(t('stSpent') === 'USD 50.50', 'stats: cancelled orders excluded from total');
  ok(t('acctAvatar') === 'AM' && t('acctEmailLine') === 'alice@x.com', 'header: two-letter initials and email shown');
  ok(t('welcomeName') === 'Alice' && t('tabOrdersN') === '3', 'header: first name and orders tab count');
  ok(w.document.querySelectorAll('#latestOrder .acct-order').length === 1 && /Order #101/.test(t('latestOrder')), 'overview: latest order card shown');
  ok(w.document.querySelectorAll('#ordersList .acct-steps').length === 3, 'orders: progress tracker on every order');
  ok(w.document.querySelectorAll('#ordersList .acct-steps')[0].querySelectorAll('li.on').length === 3, 'orders: shipped order highlights 3 of 4 steps');
  ok(w.document.querySelector('.acct-steps.cancelled'), 'orders: cancelled order is styled as cancelled');
}
{ // settings tab
  const w = page(fake([])); await tick(); await tick();
  const d = w.document;
  ok(d.getElementById('paneSettings').contains(d.getElementById('profileForm')) && d.getElementById('paneSettings').contains(d.getElementById('pwForm')), 'settings: profile and password live in one Settings tab');
  ok(d.getElementById('setEmail').textContent === 'alice@x.com', 'settings: session section shows email');
}
{ // security controls exist in the page
  const w = page(fake([])); await tick();
  const d = w.document;
  ok(d.getElementById('pw-cur') && d.getElementById('mfaStatus') && d.getElementById('signOutOthers') && d.getElementById('exportData') && d.getElementById('deleteAcct') && d.getElementById('mfaLogin'), 'security: current-password, 2FA, sessions, export and delete controls are present');
}
{ // order filters
  const w = page(fake(orders)); await tick(); await tick();
  const d = w.document, n = () => d.querySelectorAll('#ordersList .acct-order').length;
  ok(n() === 3, 'filter: All shows every order');
  d.querySelector('[data-filter="open"]').click();
  ok(n() === 1 && d.querySelector('[data-filter="open"]').getAttribute('aria-pressed') === 'true', 'filter: In progress shows 1 and sets aria-pressed');
  d.querySelector('[data-filter="cancelled"]').click();
  ok(n() === 1, 'filter: Cancelled shows 1');
  d.querySelector('[data-filter="delivered"]').click(); d.querySelector('[data-filter="all"]').click();
  ok(n() === 3, 'filter: back to All');
}
{ // initials fallbacks
  const one = fake([], { user: { id: 'u2', email: 'bob@x.com', user_metadata: {} } });
  one.from = () => ({ select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return Promise.resolve({ data: [], error: null }); }, maybeSingle: async () => ({ data: null }), update() { return this; } });
  const w = page(one); await tick(); await tick();
  ok(w.document.getElementById('acctAvatar').textContent === 'B', 'initials: no name falls back to email letter');
}
{ // empty state
  const w = page(fake([])); await tick(); await tick();
  ok(/No orders yet/.test(w.document.getElementById('ordersList').textContent) && w.document.querySelector('#ordersList a[href="products.html"]'), 'orders: empty state links to products');
}
{ // change password
  updated = null;
  const w = page(fake([])); await tick(); await tick();
  const d = w.document;
  d.getElementById('pw-new').value = 'Cedar-Plank-4417'; d.getElementById('pw-new2').value = 'Cedar-Plank-4417'; submit(w, 'pwForm'); await tick();
  ok(updated === null, 'change password: current password is required');
  d.getElementById('pw-cur').value = 'old-password-1';
  d.getElementById('pw-new').value = 'abc'; d.getElementById('pw-new2').value = 'abc'; submit(w, 'pwForm'); await tick();
  ok(updated === null, 'change password: weak password blocked');
  d.getElementById('pw-new').value = 'Abcdefg12'; d.getElementById('pw-new2').value = 'Abcdefg12'; submit(w, 'pwForm'); await tick(); await tick();
  ok(updated === null, 'change password: 9-character password refused by policy');
  d.getElementById('pw-new').value = 'Cedar-Plank-4417'; d.getElementById('pw-new2').value = 'Cedar-Plank-4418'; submit(w, 'pwForm'); await tick();
  ok(updated === null, 'change password: mismatch blocked');
  d.getElementById('pw-new').value = 'Cedar-Plank-4417'; d.getElementById('pw-new2').value = 'Cedar-Plank-4417'; submit(w, 'pwForm'); await tick(); await tick(); await tick();
  ok(updated && updated.password === 'Cedar-Plank-4417', 'change password: valid change sent to Supabase');
  ok(/Password updated/.test(d.getElementById('acctMsg').textContent), 'change password: success message shown');
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
