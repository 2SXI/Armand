/* Armand — customer accounts: register, sign in, reset password, profile, "My orders".
 * Uses Supabase Auth. Passwords are hashed by Supabase and never touch our own tables.
 * What a customer may read is enforced in the database (row-level security), not here. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const sb = (typeof getSB === 'function') ? getSB() : null;   // shared client from armand-shop.js

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
    $('welcomeName').textContent = ($('pf-name').value || user.email || '').split(' ')[0];
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
    $('welcomeName').textContent = name.split(' ')[0];
    banner('Details saved.', 'ok');
  });

  const money = n => 'USD ' + Number(n || 0).toFixed(2);
  async function loadOrders() {
    const list = $('ordersList');
    list.innerHTML = '<p class="acct-muted">Loading your orders…</p>';
    const { data, error } = await sb.from('orders')
      .select('id, created_at, status, total, payment_method, items')
      .order('created_at', { ascending: false }).limit(50);
    if (error) { list.innerHTML = '<p class="acct-muted">Could not load your orders. Please refresh the page.</p>'; return; }
    if (!data.length) {
      list.innerHTML = '<p class="acct-muted">No orders yet. Orders you place while signed in will appear here. <a href="products.html">Browse products</a>.</p>';
      return;
    }
    const BADGE = { pending: 'secondary', confirmed: 'primary', shipped: 'info', delivered: 'success', cancelled: 'danger' };
    list.innerHTML = data.map(o => {
      const when = new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const items = (o.items || []).map(i => `<li class="py-1">${esc(i.name)} <b>× ${esc(i.qty)}</b></li>`).join('');
      const st = esc(o.status || 'pending');
      return `<article class="card mb-3 acct-order">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center"><strong>Order #${esc(o.id)}</strong><span class="badge bg-${BADGE[st] || 'secondary'}">${st}</span></div>
          <div class="acct-muted">${when} · ${esc(o.payment_method || '')}</div>
          <ul class="list-unstyled my-3">${items}</ul>
          <div class="d-flex justify-content-between border-top pt-2"><span>Total</span><strong>${money(o.total)}</strong></div>
        </div>
      </article>`;
    }).join('');
  }

  $('logoutBtn').addEventListener('click', async () => {
    await sb.auth.signOut();
    banner('You have been signed out.', 'ok');
    await render();
  });

  let recovering = /type=recovery/.test(location.hash);   // arrived from a reset-password email
  async function render() {
    if (recovering) { show('viewRecover'); return; }
    if (!sb) { show('viewAuth'); banner('Cannot reach the account service. Please try again later.', 'err'); return; }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { show('viewAuth'); return; }
    show('viewAccount');
    await Promise.all([loadProfile(session.user), loadOrders()]);
  }

  if (sb) {
    sb.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') { recovering = true; show('viewRecover'); }
    });
  }
  render();
})();
