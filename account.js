/* Armand — customer accounts: register, sign in, reset password, profile, "My orders".
 * Uses Supabase Auth. Passwords are hashed by Supabase and never touch our own tables.
 * What a customer may read is enforced in the database (row-level security), not here. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const sb = (typeof getSB === 'function') ? getSB() : null;   // shared client from armand-shop.js

  function initials(name, email) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (String(email || 'A').charAt(0) || 'A').toUpperCase();
  }
  function paintIdentity(name, email) {
    const first = (name || email || '').split(' ')[0];
    $('welcomeName').textContent = first;
    $('acctAvatar').textContent = initials(name, email);
    $('acctEmailLine').textContent = email || '';
    $('setEmail').textContent = email || '';
  }

  const views = ['viewAuth', 'viewAccount', 'viewRecover'];
  function show(id) { views.forEach(v => { $(v).hidden = v !== id; }); }

  function banner(msg, kind) {            // kind: 'ok' | 'err'
    const el = $('acctMsg');
    el.textContent = msg || '';
    el.className = msg ? ('alert mb-4 ' + (kind === 'ok' ? 'alert-success' : 'alert-danger')) : '';
    el.hidden = !msg;
  }
  function busy(btn, on, label) {
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; }
    else if (btn.dataset.label) btn.textContent = btn.dataset.label;
  }
  function friendly(err) {
    const m = (err && err.message) || '';
    if (/invalid login/i.test(m))        return 'Incorrect email or password.';
    if (/already registered|already been registered/i.test(m)) return 'An account with this email already exists. Try signing in.';
    if (/email not confirmed/i.test(m))  return 'Please confirm your email first. Check your inbox for the link.';
    if (/rate limit|too many/i.test(m))  return 'Too many attempts. Please wait a few minutes and try again.';
    if (/password/i.test(m))             return m;
    return 'Something went wrong. Please try again, or WhatsApp us on 078 079 3585.';
  }

  /* ── tabs (Bootstrap handles clicks and arrow keys) ───── */
  function selectTab(which) {
    const btn = $('tab' + which);
    if (window.bootstrap && bootstrap.Tab) bootstrap.Tab.getOrCreateInstance(btn).show();
    banner('');
  }
  ['tabLogin', 'tabRegister'].forEach(id => $(id).addEventListener('show.bs.tab', () => banner('')));

  /* ── live validation hints ────────────────────────────── */
  AV.live($('reg-name'),  () => AV.name($('reg-name').value, 'full name'));
  AV.live($('reg-email'), () => AV.email($('reg-email').value));
  AV.live($('reg-phone'), () => AV.phone($('reg-phone').value));
  AV.live($('reg-pass'),  () => AV.password($('reg-pass').value));
  AV.live($('reg-pass2'), () => AV.match($('reg-pass').value, $('reg-pass2').value));
  AV.live($('log-email'), () => AV.email($('log-email').value));

  /* ── show / hide password ─────────────────────────────── */
  document.querySelectorAll('[data-toggle-pw]').forEach(b => b.addEventListener('click', () => {
    const inp = $(b.dataset.togglePw), show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.textContent = show ? 'Hide' : 'Show';
    b.setAttribute('aria-pressed', String(show));
    b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  }));

  /* ── password strength meter ──────────────────────────── */
  $('reg-pass').addEventListener('input', () => {
    const v = $('reg-pass').value;
    let n = 0;
    if (v.length >= 8) n++;
    if (/[A-Za-z]/.test(v) && /[0-9]/.test(v)) n++;
    if (v.length >= 12) n++;
    if (/[^A-Za-z0-9]/.test(v) && /[A-Z]/.test(v)) n++;
    const bar = $('pwBar');
    bar.style.width = (v ? Math.max(n, 1) * 25 : 0) + '%';
    bar.style.background = ['#d9534f', '#d9534f', '#f0ad4e', '#8bc34a', '#2e9e5b'][v ? Math.max(n, 1) : 0];
  });

  /* ── register ─────────────────────────────────────────── */
  $('registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    banner('');
    if ($('reg-website').value) return;                    // honeypot
    const f = { name: $('reg-name').value.trim(), email: $('reg-email').value.trim(),
                phone: $('reg-phone').value.trim(), pass: $('reg-pass').value, pass2: $('reg-pass2').value };
    const ok = AV.check([
      [$('reg-name'),  AV.name(f.name, 'full name')],
      [$('reg-email'), AV.email(f.email)],
      [$('reg-phone'), AV.phone(f.phone)],
      [$('reg-pass'),  AV.password(f.pass)],
      [$('reg-pass2'), AV.match(f.pass, f.pass2)],
      [$('reg-terms'), $('reg-terms').checked ? '' : 'Please accept the Privacy Policy to continue.'],
    ]);
    if (!ok) return;
    if (!sb) { banner('Cannot reach the account service. Please try again later.', 'err'); return; }

    const btn = $('regBtn'); busy(btn, true, 'Creating account…');
    const { data, error } = await sb.auth.signUp({
      email: f.email, password: f.pass,
      options: { data: { full_name: f.name, phone: f.phone }, emailRedirectTo: location.origin + location.pathname },
    });
    busy(btn, false);
    if (error) { banner(friendly(error), 'err'); return; }

    // Supabase returns a user with no identities when the email is already taken.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      banner('An account with this email already exists. Try signing in.', 'err'); return;
    }
    $('registerForm').reset();
    if (data.session) { await render(); }                  // email confirmation is switched off
    else { selectTab('Login'); banner('Account created. We sent a confirmation link to ' + f.email + '. Open it, then sign in.', 'ok'); }
  });

  /* ── sign in ──────────────────────────────────────────── */
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    banner('');
    const email = $('log-email').value.trim(), pass = $('log-pass').value;
    const ok = AV.check([
      [$('log-email'), AV.email(email)],
      [$('log-pass'),  pass ? '' : 'Please enter your password.'],
    ]);
    if (!ok) return;
    if (!sb) { banner('Cannot reach the account service. Please try again later.', 'err'); return; }
    const btn = $('logBtn'); busy(btn, true, 'Signing in…');
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    busy(btn, false);
    if (error) { banner(friendly(error), 'err'); $('log-pass').value = ''; return; }
    $('loginForm').reset();
    await render();
  });

  /* ── forgot / reset password ──────────────────────────── */
  $('forgotLink').addEventListener('click', async e => {
    e.preventDefault();
    banner('');
    const email = $('log-email').value.trim();
    const msg = AV.email(email);
    AV.setError($('log-email'), msg);
    if (msg) { $('log-email').focus(); banner('Enter your email above, then click “Forgot password?” again.', 'err'); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    // Same message either way, so the form can't be used to discover who has an account.
    if (error && /rate limit/i.test(error.message)) { banner(friendly(error), 'err'); return; }
    banner('If an account exists for ' + email + ', a reset link is on its way.', 'ok');
  });

  $('recoverForm').addEventListener('submit', async e => {
    e.preventDefault();
    const p1 = $('rec-pass').value, p2 = $('rec-pass2').value;
    if (!AV.check([[$('rec-pass'), AV.password(p1)], [$('rec-pass2'), AV.match(p1, p2)]])) return;
    const btn = $('recBtn'); busy(btn, true, 'Saving…');
    const { error } = await sb.auth.updateUser({ password: p1 });
    busy(btn, false);
    if (error) { banner(friendly(error), 'err'); return; }
    $('recoverForm').reset();
    recovering = false;
    history.replaceState(null, '', location.pathname);
    await render();
    banner('Password updated.', 'ok');
  });

  /* ── signed-in view ───────────────────────────────────── */
  async function loadProfile(user) {
    const { data } = await sb.from('profiles').select('full_name, phone').eq('user_id', user.id).maybeSingle();
    $('pf-name').value  = (data && data.full_name) || (user.user_metadata && user.user_metadata.full_name) || '';
    $('pf-phone').value = (data && data.phone)     || (user.user_metadata && user.user_metadata.phone)     || '';
    $('pf-email').value = user.email || '';
    paintIdentity($('pf-name').value, user.email);
    if (user.created_at) {
      const d = new Date(user.created_at);
      if (!isNaN(d)) $('acctSince').textContent = 'Member since ' + d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
  }

  $('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('pf-name').value.trim(), phone = $('pf-phone').value.trim();
    if (!AV.check([[$('pf-name'), AV.name(name, 'full name')], [$('pf-phone'), AV.phone(phone)]])) return;
    const { data: { user } } = await sb.auth.getUser();
    const btn = $('pfBtn'); busy(btn, true, 'Saving…');
    const { error } = await sb.from('profiles').update({ full_name: name, phone }).eq('user_id', user.id);
    busy(btn, false);
    if (error) { banner('Could not save your details. Please try again.', 'err'); return; }
    paintIdentity(name, $('pf-email').value);
    if (window.refreshNavAccount) window.refreshNavAccount();
    banner('Details saved.', 'ok');
  });

  $('pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const p1 = $('pw-new').value, p2 = $('pw-new2').value;
    if (!AV.check([[$('pw-new'), AV.password(p1)], [$('pw-new2'), AV.match(p1, p2)]])) return;
    const btn = $('pwBtn'); busy(btn, true, 'Updating…');
    const { error } = await sb.auth.updateUser({ password: p1 });
    busy(btn, false);
    if (error) { banner(friendly(error), 'err'); return; }
    $('pwForm').reset();
    banner('Password updated.', 'ok');
  });

  const money = n => 'USD ' + Number(n || 0).toFixed(2);
  const BADGE = { pending: 'secondary', confirmed: 'primary', shipped: 'info', delivered: 'success', cancelled: 'danger' };
  const STEPS = ['pending', 'confirmed', 'shipped', 'delivered'];
  const OPEN = ['pending', 'confirmed', 'shipped'];
  let allOrders = [], activeFilter = 'all';

  function orderCard(o, expanded) {
    const when = new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const lines = o.items || [];
    const count = lines.reduce((t, i) => t + (Number(i.qty) || 0), 0);
    const items = lines.map(i => `<li class="py-1">${esc(i.name)} <b>× ${esc(i.qty)}</b></li>`).join('');
    const st = esc(o.status || 'pending'), at = STEPS.indexOf(st);
    const steps = '<ol class="acct-steps' + (st === 'cancelled' ? ' cancelled' : '') + '" aria-label="Order progress">' +
      STEPS.map((x, i) => '<li' + (at >= i ? ' class="on"' : '') + '>' + x + '</li>').join('') + '</ol>';
    return `<article class="card mb-3 acct-order">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center"><strong class="acct-order-no">Order #${esc(o.id)}</strong><span class="badge bg-${BADGE[st] || 'secondary'}">${st}</span></div>
        <div class="acct-muted">${when} · ${esc(o.payment_method || '')}${count ? ' · ' + count + (count === 1 ? ' item' : ' items') : ''}</div>
        ${steps}
        ${expanded ? `<ul class="list-unstyled my-3">${items}</ul>` : (items ? `<details class="acct-more"><summary>View items</summary><ul class="list-unstyled my-2">${items}</ul></details>` : '')}
        <div class="d-flex justify-content-between border-top pt-2 mt-2"><span>Total</span><strong>${money(o.total)}</strong></div>
      </div>
    </article>`;
  }

  function renderOrders() {
    const list = $('ordersList');
    const f = activeFilter;
    const rows = allOrders.filter(o => {
      const st = o.status || 'pending';
      return f === 'all' || (f === 'open' ? OPEN.includes(st) : st === f);
    });
    if (!allOrders.length) {
      list.innerHTML = '<div class="acct-empty"><strong>No orders yet</strong>No orders yet. Orders you place while signed in will appear here.<br><a class="btn btn-brand" href="products.html">Browse products</a></div>';
      return;
    }
    list.innerHTML = rows.length ? rows.map(o => orderCard(o, false)).join('')
      : '<div class="acct-empty"><strong>Nothing here</strong>No orders match this filter.</div>';
  }

  document.querySelectorAll('.acct-chip').forEach(b => b.addEventListener('click', () => {
    activeFilter = b.dataset.filter;
    document.querySelectorAll('.acct-chip').forEach(x => {
      const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on));
    });
    renderOrders();
  }));

  async function loadOrders() {
    const list = $('ordersList');
    list.innerHTML = '<p class="acct-muted">Loading your orders…</p>';
    const { data, error } = await sb.from('orders')
      .select('id, created_at, status, total, payment_method, items')
      .order('created_at', { ascending: false }).limit(50);
    if (error) {
      list.innerHTML = '<p class="acct-muted">Could not load your orders. Please refresh the page.</p>';
      $('latestOrder').innerHTML = '<p class="acct-muted">Could not load your orders.</p>';
      return;
    }
    allOrders = data;
    const sum = data.filter(o => o.status !== 'cancelled');
    $('stOrders').textContent = data.length;
    $('tabOrdersN').textContent = data.length;
    $('stOpen').textContent = data.filter(o => OPEN.includes(o.status || 'pending')).length;
    $('stSpent').textContent = money(sum.reduce((t, o) => t + Number(o.total || 0), 0));
    $('latestOrder').innerHTML = data.length ? orderCard(data[0], true)
      : '<div class="acct-empty"><strong>No orders yet</strong>Your first order will show up here.<br><a class="btn btn-brand" href="products.html">Browse products</a></div>';
    renderOrders();
  }

  async function signOut() {
    await sb.auth.signOut();
    banner('You have been signed out.', 'ok');
    await render();
  }
  $('logoutBtn').addEventListener('click', signOut);
  $('logoutBtn2').addEventListener('click', signOut);

  /* deep links from the nav menu: account.html#orders / #settings */
  const TABS = { overview: 'tabOverview', orders: 'tabOrders', settings: 'tabSettings' };
  function tabFromHash() {
    const h = location.hash.replace('#', '').toLowerCase();
    const btn = TABS[h] && $(TABS[h]);
    if (btn && window.bootstrap && bootstrap.Tab) bootstrap.Tab.getOrCreateInstance(btn).show();
  }
  window.addEventListener('hashchange', () => { if (!$('viewAccount').hidden) tabFromHash(); });
  document.querySelectorAll('.acct-tab').forEach(b => b.addEventListener('shown.bs.tab', () => {
    const k = Object.keys(TABS).find(x => TABS[x] === b.id);
    if (k && history.replaceState) history.replaceState(null, '', k === 'overview' ? location.pathname : '#' + k);
  }));

  let recovering = /type=recovery/.test(location.hash);   // arrived from a reset-password email
  async function render() {
    if (recovering) { show('viewRecover'); return; }
    if (!sb) { show('viewAuth'); banner('Cannot reach the account service. Please try again later.', 'err'); return; }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { show('viewAuth'); return; }
    show('viewAccount');
    tabFromHash();
    await Promise.all([loadProfile(session.user), loadOrders()]);
  }

  if (sb) {
    sb.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') { recovering = true; show('viewRecover'); }
    });
  }
  render();
})();
