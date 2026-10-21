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
  auth: { getSession: async () => ({ data: { session } }), onAuthStateChange() {}, signOut: async () => {},
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
  ok(t('acctAvatar') === 'A' && t('acctEmailLine') === 'alice@x.com', 'header: avatar initial and email shown');
  ok(w.document.querySelectorAll('.acct-steps').length === 3, 'orders: progress tracker on every order');
  ok(w.document.querySelectorAll('.acct-steps')[0].querySelectorAll('li.on').length === 3, 'orders: shipped order highlights 3 of 4 steps');
  ok(w.document.querySelector('.acct-steps.cancelled'), 'orders: cancelled order is styled as cancelled');
}
{ // empty state
  const w = page(fake([])); await tick(); await tick();
  ok(/No orders yet/.test(w.document.getElementById('ordersList').textContent) && w.document.querySelector('#ordersList a[href="products.html"]'), 'orders: empty state links to products');
}
{ // change password
  updated = null;
  const w = page(fake([])); await tick(); await tick();
  const d = w.document;
  d.getElementById('pw-new').value = 'abc'; d.getElementById('pw-new2').value = 'abc'; submit(w, 'pwForm'); await tick();
  ok(updated === null, 'change password: weak password blocked');
  d.getElementById('pw-new').value = 'abcdefg1'; d.getElementById('pw-new2').value = 'abcdefg2'; submit(w, 'pwForm'); await tick();
  ok(updated === null, 'change password: mismatch blocked');
  d.getElementById('pw-new').value = 'abcdefg1'; d.getElementById('pw-new2').value = 'abcdefg1'; submit(w, 'pwForm'); await tick();
  ok(updated && updated.password === 'abcdefg1', 'change password: valid change sent to Supabase');
  ok(/Password updated/.test(d.getElementById('acctMsg').textContent), 'change password: success message shown');
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
