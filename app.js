/**
 * ARMAND CARPENTRY & DESIGNS — app.js  v5.0
 * ─────────────────────────────────────────────────────────────
 * Fully responsive popup cart drawer + all page interactions.
 * Works on every screen: 320 px phone → 4K desktop.
 * ─────────────────────────────────────────────────────────────
 */
'use strict';

/* ═══════════════════════════════════════════════════════════════
   SUPABASE CONFIG
═══════════════════════════════════════════════════════════════ */
const SUPABASE_URL      = 'https://nasbxjharopveynnwgrg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_io0oLODozq0xdUJiNT37tQ_u2PWURX0';
const WA_NUMBER         = '263780793585';

/* ═══════════════════════════════════════════════════════════════
   ENQUIRY FORM → SUPABASE
═══════════════════════════════════════════════════════════════ */
async function submitToSupabase(data) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/enquiries`, {
      method : 'POST',
      headers: {
        'apikey'       : SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type' : 'application/json',
        'Prefer'       : 'return=representation',
      },
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: result };
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function submitEnquiry(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('cfSubmitBtn');
  const successEl = document.getElementById('cfSuccess');
  const errorEl   = document.getElementById('cfError');
  // Honeypot: real visitors never fill this hidden field; bots do.
  if (document.getElementById('cf-website')?.value) {
    if (successEl) successEl.style.display = 'block';
    e.target.reset();
    return;
  }
  const name      = document.getElementById('cf-name')?.value?.trim();
  const phone     = document.getElementById('cf-phone')?.value?.trim();
  const email     = document.getElementById('cf-email')?.value?.trim();
  const type      = document.getElementById('cf-type')?.value;
  const cat       = document.getElementById('cf-cat')?.value;
  const message   = document.getElementById('cf-message')?.value?.trim();

  if (!name || !phone || !type || !message) { showToast('Please fill in all required fields.'); return; }

  submitBtn.textContent = 'Submitting...';
  submitBtn.disabled    = true;
  if (successEl) successEl.style.display = 'none';
  if (errorEl)   errorEl.style.display   = 'none';

  const result = await submitToSupabase({
    name, phone,
    email   : email || null,
    subject : type + (cat ? ' · ' + cat : ''),
    message,
  });

  submitBtn.textContent = 'Submit Enquiry →';
  submitBtn.disabled    = false;

  if (result.success) {
    if (successEl) successEl.style.display = 'block';
    e.target.reset();
  } else {
    console.error('[Armand enquiry]', result.error);
    if (errorEl) errorEl.style.display = 'block';
  }
}

/* ═══════════════════════════════════════════════════════════════
   CATEGORY FILTER / SORT
═══════════════════════════════════════════════════════════════ */
function filterCat(btn, cat) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.product-card').forEach(card => {
    const show = cat === 'all' || card.dataset.cat === cat;
    card.classList.toggle('hidden', !show);
    if (show) card.style.animation = 'fadeIn 0.3s ease forwards';
  });
}

function showAllProducts() {
  const btn = document.querySelector('.cat-btn[data-cat="all"]');
  if (btn) filterCat(btn, 'all');
  document.querySelector('.products-section')?.scrollIntoView({ behavior: 'smooth' });
}

function sortProducts(value) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll('.product-card'));
  const getPrice = c => parseFloat(c.dataset.price || 0);
  const getName  = c => (c.querySelector('.pc-name')?.textContent || '').trim();
  if      (value === 'name')       cards.sort((a,b) => getName(a).localeCompare(getName(b)));
  else if (value === 'price-asc')  cards.sort((a,b) => getPrice(a) - getPrice(b));
  else if (value === 'price-desc') cards.sort((a,b) => getPrice(b) - getPrice(a));
  else if (value === 'new')        cards.sort((a,b) => (b.querySelector('.pc-badge.new')?1:0) - (a.querySelector('.pc-badge.new')?1:0));
  else cards.sort((a,b) => parseInt(a.dataset.originalIndex||0) - parseInt(b.dataset.originalIndex||0));
  cards.forEach(c => grid.appendChild(c));
}

/* ═══════════════════════════════════════════════════════════════
   WISHLIST — event delegation (works with dynamically loaded cards)
═══════════════════════════════════════════════════════════════ */
function initWishlists() {
  const grid = document.getElementById('productsGrid');
  if (!grid || grid.dataset.wishlistInit) return;
  grid.dataset.wishlistInit = '1';
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.pc-wishlist');
    if (!btn) return;
    e.stopPropagation();
    const wished = btn.dataset.wished === '1';
    btn.dataset.wished = wished ? '0' : '1';
    btn.style.color    = wished ? '' : '#e8453c';
    btn.innerHTML = wished
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="#e8453c" stroke="#e8453c" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    showToast(wished ? 'Removed from saved items' : 'Saved to wishlist');
  });
}

/* ═══════════════════════════════════════════════════════════════
   CART UI — fully responsive popup drawer
   ─────────────────────────────────────────────────────────────
   Breakpoints handled entirely in JS + inline styles so it works
   even when styles.css cart overrides are missing/stale.
═══════════════════════════════════════════════════════════════ */
const CartUI = {

  /* ── open / close / toggle ─────────────────────────────── */
  open() {
    this._build();
    const d = document.getElementById('brocCartDrawer');
    const o = document.getElementById('brocCartOverlay');
    if (!d || !o) return;
    // Force layout before adding open so transition fires
    d.getBoundingClientRect();
    d.classList.add('bcd-open');
    o.classList.add('bcd-open');
    document.body.style.overflow = 'hidden';
    this.render();
  },

  close() {
    const d = document.getElementById('brocCartDrawer');
    const o = document.getElementById('brocCartOverlay');
    if (d) d.classList.remove('bcd-open');
    if (o) o.classList.remove('bcd-open');
    document.body.style.overflow = '';
  },

  toggle() {
    const d = document.getElementById('brocCartDrawer');
    d?.classList.contains('bcd-open') ? this.close() : this.open();
  },

  /* ── build DOM once ────────────────────────────────────── */
  _built: false,
  _build() {
    if (this._built) return;
    this._built = true;

    /* Inject all cart CSS into <head> — self-contained, no external dep */
    const style = document.createElement('style');
    style.textContent = `
/* ── Cart Overlay ───────────────────────────────────────────── */
#brocCartOverlay{
  position:fixed;inset:0;z-index:1098;
  background:rgba(0,0,0,.55);
  backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
  opacity:0;visibility:hidden;
  transition:opacity .32s ease,visibility .32s ease;
}
#brocCartOverlay.bcd-open{opacity:1;visibility:visible;}

/* ── Cart Drawer ─────────────────────────────────────────────── */
#brocCartDrawer{
  position:fixed;top:0;right:0;
  width:min(420px,100vw);
  height:100%;height:100dvh;
  background:#1e1d1f;
  border-left:1px solid rgba(90,90,90,.22);
  box-shadow:none;
  z-index:1099;
  display:flex;flex-direction:column;
  transform:translateX(100%);
  transition:transform .32s cubic-bezier(.4,0,.2,1);
  will-change:transform;
}
#brocCartDrawer.bcd-open{transform:translateX(0);box-shadow:-16px 0 56px rgba(0,0,0,.4);}

/* ── Header ──────────────────────────────────────────────────── */
.bcd-hdr{
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 20px 16px;
  border-bottom:1px solid rgba(90,90,90,.15);
  flex-shrink:0;
  gap:12px;
}
.bcd-hdr-left{display:flex;align-items:center;gap:10px;min-width:0;}
.bcd-title{
  font-family:'Saira',sans-serif;
  font-size:17px;font-weight:900;text-transform:uppercase;
  letter-spacing:1.5px;color:#e2e2e2;white-space:nowrap;
}
.bcd-badge{
  background:#2a282b;color:#fff;
  font-family:'Barlow Semi Condensed','Barlow',sans-serif;font-size:11px;font-weight:700;
  padding:2px 7px;letter-spacing:.5px;
  min-width:18px;text-align:center;
  display:none;flex-shrink:0;
}
.bcd-badge.vis{display:inline-block;}
.bcd-close{
  width:34px;height:34px;min-width:34px;
  display:flex;align-items:center;justify-content:center;
  background:none;border:1px solid rgba(90,90,90,.2);
  color:rgba(226,226,226,.5);cursor:pointer;
  transition:all .2s;flex-shrink:0;
}
.bcd-close:hover{color:#e2e2e2;border-color:rgba(90,90,90,.5);}

/* ── Empty state ─────────────────────────────────────────────── */
.bcd-empty{
  flex:1;display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  gap:10px;text-align:center;padding:32px 24px;
}
.bcd-empty-icon{color:rgba(90,90,90,.22);margin-bottom:4px;}
.bcd-empty-title{
  font-family:'Saira',sans-serif;font-size:15px;font-weight:800;
  text-transform:uppercase;letter-spacing:1px;color:rgba(226,226,226,.22);
}
.bcd-empty-sub{font-size:12px;color:rgba(226,226,226,.15);line-height:1.7;}
.bcd-empty-cta{
  margin-top:8px;padding:11px 22px;
  background:transparent;border:1px solid rgba(90,90,90,.3);
  color:#5a5a5a;cursor:pointer;
  font-family:'Saira',sans-serif;
  font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;
  transition:all .2s;
}
.bcd-empty-cta:hover{background:rgba(90,90,90,.1);color:#e2e2e2;}

/* ── Items list ──────────────────────────────────────────────── */
.bcd-items{
  flex:1;overflow-y:auto;overflow-x:hidden;
  padding:0;
  /* Smooth momentum scrolling on iOS */
  -webkit-overflow-scrolling:touch;
  overscroll-behavior:contain;
}
.bcd-items::-webkit-scrollbar{width:3px;}
.bcd-items::-webkit-scrollbar-thumb{background:rgba(90,90,90,.3);}

/* ── Item row ────────────────────────────────────────────────── */
.bcd-item{
  display:grid;
  grid-template-columns:56px 1fr;
  gap:12px;
  align-items:start;
  padding:14px 20px;
  border-bottom:1px solid rgba(90,90,90,.07);
  transition:background .18s;
}
.bcd-item:last-child{border-bottom:none;}
.bcd-item:hover{background:rgba(90,90,90,.04);}

.bcd-thumb{
  position:relative;
  width:56px;height:56px;min-width:56px;
  background:rgba(226,226,226,.04);
  border:1px solid rgba(90,90,90,.12);
  display:flex;align-items:center;justify-content:center;
  overflow:hidden;flex-shrink:0;
}
.bcd-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
.bcd-thumb-ph{color:rgba(90,90,90,.2);}

.bcd-info{min-width:0;}
.bcd-iname{
  font-family:'Saira',sans-serif;font-size:13px;font-weight:700;
  text-transform:uppercase;letter-spacing:.3px;color:#e2e2e2;
  line-height:1.2;margin-bottom:2px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.bcd-iprice{
  font-family:'Barlow Semi Condensed','Barlow',sans-serif;font-size:11px;
  color:rgba(226,226,226,.32);margin-bottom:9px;
}
.bcd-qty-row{display:flex;align-items:center;gap:0;flex-wrap:nowrap;}
.bcd-qbtn{
  width:28px;height:28px;min-width:28px;
  display:flex;align-items:center;justify-content:center;
  background:rgba(90,90,90,.1);
  border:1px solid rgba(90,90,90,.22);
  color:#e2e2e2;font-size:16px;line-height:1;
  cursor:pointer;transition:background .15s;flex-shrink:0;
  /* Big enough tap target on mobile */
  touch-action:manipulation;
}
.bcd-qbtn:hover:not(:disabled){background:rgba(90,90,90,.25);}
.bcd-qbtn:disabled{opacity:.3;cursor:not-allowed;}
.bcd-qnum{
  min-width:32px;text-align:center;
  font-family:'Barlow Semi Condensed','Barlow',sans-serif;font-size:11px;color:#e2e2e2;
  border-top:1px solid rgba(90,90,90,.2);
  border-bottom:1px solid rgba(90,90,90,.2);
  background:rgba(226,226,226,.02);
  height:28px;display:flex;align-items:center;justify-content:center;
  padding:0 4px;user-select:none;
}
.bcd-itotal{
  font-family:'Saira',sans-serif;font-size:13px;font-weight:800;
  color:#e2e2e2;white-space:nowrap;padding-top:2px;
}
.bcd-iright{
  display:flex;flex-direction:column;align-items:flex-end;
  gap:4px;flex-shrink:0;
}
.bcd-remove{
  background:none;border:none;
  font-family:'Barlow Semi Condensed','Barlow',sans-serif;font-size:11px;letter-spacing:1px;
  text-transform:uppercase;color:rgba(255,255,255,.4);
  cursor:pointer;padding:0;transition:color .15s;
  touch-action:manipulation;
}
.bcd-remove:hover{color:#fff;}

/* ── Footer ──────────────────────────────────────────────────── */
.bcd-footer{
  border-top:1px solid rgba(90,90,90,.15);
  padding:16px 20px 20px;
  flex-shrink:0;
  /* Safe area on iPhone X+ */
  padding-bottom:max(20px,env(safe-area-inset-bottom));
}

/* Delivery note */
.bcd-ship{margin-bottom:14px;}
.bcd-ship-lbl{
  display:flex;justify-content:space-between;
  font-family:'Barlow Semi Condensed','Barlow',sans-serif;font-size:11px;letter-spacing:1.5px;
  text-transform:uppercase;color:rgba(226,226,226,.28);
  margin-bottom:5px;
}
.bcd-ship-track{height:3px;background:rgba(90,90,90,.14);position:relative;overflow:hidden;}
.bcd-ship-fill{
  position:absolute;left:0;top:0;height:100%;
  background:#F36523;transition:width .5s ease;
}

/* Summary rows */
.bcd-sum{margin-bottom:12px;}
.bcd-sum-row{
  display:flex;justify-content:space-between;align-items:baseline;
  padding:3px 0;font-size:11px;color:rgba(226,226,226,.38);
}
.bcd-sum-row.total{
  border-top:1px solid rgba(90,90,90,.14);
  margin-top:6px;padding-top:10px;
}
.bcd-slbl{
  font-family:'Barlow Semi Condensed','Barlow',sans-serif;font-size:11px;
  letter-spacing:1.5px;text-transform:uppercase;
}
.bcd-sval{
  font-family:'Saira',sans-serif;font-size:12px;
  font-weight:700;color:rgba(226,226,226,.6);
}
.bcd-sum-row.total .bcd-sval{
  font-size:24px;font-weight:900;color:#e2e2e2;
}

/* Buttons */
.bcd-checkout{
  width:100%;padding:14px 12px;
  background:#fff;color:#2a282b;border:none;
  font-family:'Saira',sans-serif;
  font-size:14px;font-weight:900;letter-spacing:2px;text-transform:uppercase;
  cursor:pointer;transition:opacity .2s;
  display:flex;align-items:center;justify-content:center;gap:10px;
  margin-bottom:8px;
  touch-action:manipulation;
  /* Prevent text wrapping on small screens */
  white-space:nowrap;overflow:hidden;
}
.bcd-checkout:hover{opacity:.88;}
.bcd-wa{
  width:100%;padding:11px 12px;
  background:rgba(243,101,35,.1);
  border:1px solid rgba(243,101,35,.3);
  color:#F36523;cursor:pointer;
  font-family:'Saira',sans-serif;
  font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;
  transition:all .2s;margin-bottom:8px;
  display:flex;align-items:center;justify-content:center;gap:8px;
  white-space:nowrap;overflow:hidden;
  touch-action:manipulation;
}
.bcd-wa:hover{background:rgba(243,101,35,.18);border-color:#F36523;}
.bcd-clr{
  width:100%;padding:7px;
  background:transparent;border:none;
  color:rgba(226,226,226,.16);cursor:pointer;
  font-family:'Barlow Semi Condensed','Barlow',sans-serif;font-size:11px;
  letter-spacing:1.5px;text-transform:uppercase;
  transition:color .2s;
  touch-action:manipulation;
}
.bcd-clr:hover{color:rgba(255,255,255,.55);}

/* ── Cart count pop animation ────────────────────────────────── */
@keyframes bcdPop{0%{transform:scale(1)}45%{transform:scale(1.4)}100%{transform:scale(1)}}
.bcd-count-pop{animation:bcdPop .32s ease;}

/* ── Responsive: narrow phones (< 390 px) ────────────────────── */
@media(max-width:389px){
  #brocCartDrawer{width:100vw;}
  .bcd-item{padding:12px 14px;gap:10px;}
  .bcd-thumb{width:48px;height:48px;min-width:48px;}
  .bcd-footer{padding:14px 14px max(16px,env(safe-area-inset-bottom));}
  .bcd-hdr{padding:14px 14px 12px;}
  .bcd-checkout{font-size:12px;letter-spacing:1.5px;}
  .bcd-wa{font-size:11px;}
}

/* ── Safe-area on notched phones ─────────────────────────────── */
@supports(padding-bottom:env(safe-area-inset-bottom)){
  .bcd-footer{
    padding-bottom:max(20px,env(safe-area-inset-bottom));
  }
}
    `;
    document.head.appendChild(style);

    /* Overlay */
    const overlay = document.createElement('div');
    overlay.id = 'brocCartOverlay';
    overlay.addEventListener('click', () => this.close());
    document.body.appendChild(overlay);

    /* Drawer */
    const drawer = document.createElement('div');
    drawer.id   = 'brocCartDrawer';
    drawer.setAttribute('role','dialog');
    drawer.setAttribute('aria-modal','true');
    drawer.setAttribute('aria-label','Shopping cart');
    drawer.innerHTML = `
      <div class="bcd-hdr">
        <div class="bcd-hdr-left">
          <span class="bcd-title">Your Cart</span>
          <span class="bcd-badge" id="bcdBadge">0</span>
        </div>
        <button class="bcd-close" id="bcdClose" aria-label="Close cart">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div id="bcdBody" style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;"></div>
      <div class="bcd-footer" id="bcdFooter" style="display:none;"></div>`;
    document.body.appendChild(drawer);

    /* Close button */
    drawer.querySelector('#bcdClose').addEventListener('click', () => this.close());

    /* Qty / remove delegation */
    drawer.addEventListener('click', e => {
      const qb = e.target.closest('.bcd-qbtn');
      if (qb) {
        e.stopPropagation();
        if (typeof Cart !== 'undefined') Cart.updateQty(qb.dataset.id, parseInt(qb.dataset.delta, 10));
        return;
      }
      const rb = e.target.closest('.bcd-remove');
      if (rb) {
        e.stopPropagation();
        if (typeof Cart !== 'undefined') Cart.remove(rb.dataset.id);
      }
    });

    /* Swipe-to-close on mobile */
    let _touchX = 0;
    drawer.addEventListener('touchstart', e => { _touchX = e.touches[0].clientX; }, { passive: true });
    drawer.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - _touchX;
      if (dx > 60) this.close(); // swipe right → close
    }, { passive: true });

    /* Escape key */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawer.classList.contains('bcd-open')) this.close();
    });
  },

  /* ── render contents ───────────────────────────────────── */
  render() {
    this._build();
    const items  = (typeof Cart !== 'undefined') ? Cart._items  : [];
    const total  = (typeof Cart !== 'undefined') ? Cart.total   : 0;
    const count  = (typeof Cart !== 'undefined') ? Cart.count   : 0;

    /* Badge */
    const badge = document.getElementById('bcdBadge');
    if (badge) { badge.textContent = count; badge.classList.toggle('vis', count > 0); }

    const body   = document.getElementById('bcdBody');
    const footer = document.getElementById('bcdFooter');
    if (!body || !footer) return;

    /* ── Empty ── */
    if (!items.length) {
      footer.style.display = 'none';
      body.innerHTML = `
        <div class="bcd-empty">
          <div class="bcd-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".35">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <div class="bcd-empty-title">Cart is empty</div>
          <div class="bcd-empty-sub">Add products from our catalogue<br>to build your order.</div>
          <button class="bcd-empty-cta" onclick="CartUI.close();if(document.getElementById('products')){document.getElementById('products').scrollIntoView({behavior:'smooth'});}else{window.location.href='products.html';}">
            Browse Products
          </button>
        </div>`;
      return;
    }

    /* ── Items ── */
    body.innerHTML = `<div class="bcd-items">${items.map(i => this._item(i)).join('')}</div>`;

    /* ── Footer ── */
    const shipMsg = 'Delivery cost is confirmed with your order';

    footer.style.display = '';
    footer.innerHTML = `
      <div class="bcd-ship">
        <div class="bcd-ship-lbl"><span>${_e(shipMsg)}</span></div>
      </div>
      <div class="bcd-sum">
        <div class="bcd-sum-row">
          <span class="bcd-slbl">Subtotal (${count} item${count!==1?'s':''})</span>
          <span class="bcd-sval">USD ${total.toFixed(2)}</span>
        </div>
        <div class="bcd-sum-row">
          <span class="bcd-slbl">Delivery</span>
          <span class="bcd-sval">Confirmed per order</span>
        </div>
        <div class="bcd-sum-row total">
          <span class="bcd-slbl">Total</span>
          <span class="bcd-sval">USD ${total.toFixed(2)}</span>
        </div>
      </div>
      <button class="bcd-checkout" id="bcdCheckoutBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0">
          <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
        Checkout — USD ${total.toFixed(2)}
      </button>
      <button class="bcd-wa" id="bcdWaBtn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
        </svg>
        Order via WhatsApp
      </button>
      <button class="bcd-clr" id="bcdClrBtn">Clear cart</button>`;

    document.getElementById('bcdCheckoutBtn')?.addEventListener('click', () => {
      this.close();
      if (typeof Checkout !== 'undefined') Checkout.open();
      else showToast('Checkout coming soon — use WhatsApp for now.');
    });
    document.getElementById('bcdWaBtn')?.addEventListener('click', () => {
      Cart?.sendViaWhatsApp?.();
    });
    document.getElementById('bcdClrBtn')?.addEventListener('click', () => {
      Cart?.clear();
      this.render();
    });
  },

  _item(item) {
    const thumb = item.image
      ? `<img src="${_e(item.image)}" alt="${_e(item.name)}" loading="lazy" onerror="brocImgFallback(this,'${_e(item.category||'')}',true)">`
      : brocPlaceholderHTML(item.category, true, item.name);
    return `
      <div class="bcd-item">
        <div class="bcd-thumb">${thumb}</div>
        <div class="bcd-info">
          <div class="bcd-iname" title="${_e(item.name)}">${_e(item.name)}</div>
          <div class="bcd-iprice">USD ${item.price.toFixed(2)} each</div>
          <div class="bcd-qty-row">
            <button class="bcd-qbtn" data-id="${_e(item.id)}" data-delta="-1"
              ${item.qty <= 1 ? 'disabled' : ''} aria-label="Decrease">−</button>
            <span class="bcd-qnum">${item.qty}</span>
            <button class="bcd-qbtn" data-id="${_e(item.id)}" data-delta="1"
              aria-label="Increase">+</button>
          </div>
        </div>
        <div class="bcd-iright">
          <span class="bcd-itotal">USD ${(item.price * item.qty).toFixed(2)}</span>
          <button class="bcd-remove" data-id="${_e(item.id)}" aria-label="Remove ${_e(item.name)}">Remove</button>
        </div>
      </div>`;
  },

  /* ── public: refresh when already open ─────────────────── */
  refresh() {
    const d = document.getElementById('brocCartDrawer');
    if (d?.classList.contains('bcd-open')) this.render();
    this.syncCount();
  },

  /* ── sync nav badge ─────────────────────────────────────── */
  syncCount() {
    const count   = (typeof Cart !== 'undefined') ? Cart.count : 0;
    const counter = document.getElementById('cartCount');
    if (!counter) return;
    const prev = parseInt(counter.textContent || '0', 10);
    counter.textContent = count;
    counter.style.background = count > 0 ? '#fff' : 'rgba(255,255,255,0.25)';
    /* Pop animation when count increases */
    if (count > prev) {
      counter.classList.remove('bcd-count-pop');
      void counter.offsetWidth; // reflow
      counter.classList.add('bcd-count-pop');
      setTimeout(() => counter.classList.remove('bcd-count-pop'), 360);
    }
  },
};

/* ── Shims so broc-shop.js keeps working ─────────────────────── */
function toggleSidebar()    { CartUI.toggle(); }
function clearEnquiry()     { typeof Cart !== 'undefined' && Cart.clear(); }
function sendEnquiryViaWA() { typeof Cart !== 'undefined' && Cart.sendViaWhatsApp?.(); }

/* ═══════════════════════════════════════════════════════════════
   NAV SCROLL
═══════════════════════════════════════════════════════════════ */
function initNavScroll() {
  const nav = document.getElementById('mainNav');
  if (!nav) return;
  let last = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 60);
    const scrollBtn = document.getElementById('scrollTop');
    if (scrollBtn) scrollBtn.classList.toggle('visible', y > 500);
    last = y;
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════════════════════════════ */
function initRevealObserver() {
  const els = document.querySelectorAll('.reveal-section, .reveal, .reveal-up');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));

  const af = document.querySelectorAll('.af-row');
  if (af.length) {
    const ioAf = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) { setTimeout(() => entry.target.classList.add('visible'), i * 100); ioAf.unobserve(entry.target); }
      });
    }, { threshold: 0.1 });
    af.forEach(el => ioAf.observe(el));
  }
}

/* ═══════════════════════════════════════════════════════════════
   COUNTER ANIMATION
═══════════════════════════════════════════════════════════════ */
function animateCount(el, target, duration = 2000) {
  const start = performance.now();
  const run = time => {
    const p = Math.min((time - start) / duration, 1);
    const v = Math.round((1 - Math.pow(1-p, 3)) * target);
    el.childNodes[0].textContent = v.toLocaleString();
    if (p < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}
function initCounters() {
  const els = document.querySelectorAll('[data-count]');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { animateCount(e.target, parseInt(e.target.dataset.count)); io.unobserve(e.target); } });
  }, { threshold: 0.5 });
  els.forEach(el => io.observe(el));
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE NAV
═══════════════════════════════════════════════════════════════ */
function initMobileNav() {
  const hamburger = document.getElementById('navHamburger');
  if (!hamburger) return;
  let panel = document.querySelector('.mobile-nav-panel');
  let overlay = document.querySelector('.mnp-overlay');
  if (!panel) {
    const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const item = (href, label) =>
      `<a href="${href}" class="mnp-link${here === href ? ' is-current' : ''}"${here === href ? ' aria-current="page"' : ''} onclick="closeMobileNav()"><span>${label}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></a>`;
    const chip = (cat, label) => `<a href="products.html?cat=${cat}" class="mnp-chip" onclick="closeMobileNav()">${label}</a>`;
    panel = document.createElement('aside');
    panel.className = 'mobile-nav-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Site menu');
    panel.innerHTML = `
      <div class="mnp-head">
        <span class="mnp-title">Menu</span>
        <button type="button" class="mnp-close" aria-label="Close menu" onclick="closeMobileNav()">&times;</button>
      </div>
      <div class="mnp-scroll">
        <nav class="mnp-nav" aria-label="Pages">
          ${item('index.html','Home')}
          ${item('products.html','Products')}
          ${item('about.html','About')}
          ${item('portfolio.html','Portfolio')}
          ${item('trade.html','Trade accounts')}
          ${item('contact.html','Contact')}
        </nav>
        <div class="mnp-group">
          <div class="mnp-group-label">Shop by category</div>
          <div class="mnp-chips">
            ${chip('boards','Boards')}${chip('edging','Edging')}${chip('hinges','Hinges')}${chip('handles','Handles')}
            ${chip('drawers','Drawers')}${chip('kitchen','Kitchen')}${chip('locks','Locks')}${chip('tools','Tools &amp; fixings')}
          </div>
        </div>
        <div class="mnp-group mnp-info">
          <div class="mnp-group-label">Visit us</div>
          <p>2142 Khami Rd, Iversens Complex, Bulawayo</p>
          <p>Mon–Fri 08:00–17:00<br>Sat 08:00–13:00</p>
          <a href="tel:+263780793585">+263 78 079 3585</a>
        </div>
      </div>
      <div class="mnp-actions">
        <a href="https://wa.me/${WA_NUMBER}" class="mnp-wa" target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
          </svg>
          WhatsApp us
        </a>
        <a href="contact.html" class="mnp-contact" onclick="closeMobileNav()">Get a quote</a>
      </div>`;
    document.body.appendChild(panel);
  }
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'mnp-overlay';
    overlay.addEventListener('click', () => window.closeMobileNav());
    document.body.appendChild(overlay);
  }
  hamburger.addEventListener('click', () => {
    if (panel.classList.contains('open')) { window.closeMobileNav(); return; }
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    panel.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    const c = panel.querySelector('.mnp-close'); if (c) c.focus({ preventScroll: true });
  });
  /* swipe right to dismiss */
  let sx = null;
  panel.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  panel.addEventListener('touchend', e => {
    if (sx !== null && e.changedTouches[0].clientX - sx > 70) window.closeMobileNav();
    sx = null;
  }, { passive: true });
  /* leaving the mobile layout while open: reset */
  window.addEventListener('resize', () => { if (window.innerWidth > 1040) window.closeMobileNav(); });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && window.closeMobileNav) window.closeMobileNav(); });
window.closeMobileNav = function() {
  const h = document.getElementById('navHamburger');
  const p = document.querySelector('.mobile-nav-panel');
  const o = document.querySelector('.mnp-overlay');
  const wasOpen = p && p.classList.contains('open');
  if (h) { h.classList.remove('open'); h.setAttribute('aria-expanded','false'); }
  if (p) p.classList.remove('open');
  if (o) o.classList.remove('open');
  document.body.style.overflow = '';
  if (wasOpen && h) h.focus({ preventScroll: true });
};

/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */
function showToast(msg, duration = 2800) {
  document.querySelectorAll('.broc-toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'broc-toast';
  t.textContent = msg;
  t.style.cssText = [
    'position:fixed',
    'bottom:88px',
    'left:50%',
    'transform:translateX(-50%) translateY(20px)',
    'background:#1e1d1f',
    'color:#e2e2e2',
    'padding:11px 22px',
    "font-family:'Barlow Semi Condensed','Barlow',sans-serif",
    'font-size:11px',
    'letter-spacing:1px',
    'border:1px solid rgba(90,90,90,.3)',
    'box-shadow:0 8px 24px rgba(0,0,0,.28)',
    'z-index:9999',
    'opacity:0',
    'transition:all .3s ease',
    'white-space:nowrap',
    'pointer-events:none',
    'max-width:calc(100vw - 40px)',
    'overflow:hidden',
    'text-overflow:ellipsis',
  ].join(';');
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; });
  setTimeout(() => {
    t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(10px)';
    setTimeout(() => t.remove(), 360);
  }, duration);
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════════════════════════ */
function initSearch() {
  const btn     = document.getElementById('searchToggle');
  const overlay = document.getElementById('searchOverlay');
  const input   = document.getElementById('searchInput');
  if (!btn || !overlay) return;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = overlay.classList.toggle('open');
    if (open && input) setTimeout(() => input.focus(), 100);
  });
  document.addEventListener('click', e => {
    if (!overlay.contains(e.target) && e.target !== btn) overlay.classList.remove('open');
  });
  if (input) {
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      document.querySelectorAll('.product-card').forEach(card => {
        if (!q) { card.classList.remove('hidden'); return; }
        const text = ((card.querySelector('.pc-name')?.textContent||'') + ' ' + (card.querySelector('.pc-sku')?.textContent||'')).toLowerCase();
        card.classList.toggle('hidden', !text.includes(q));
      });
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') overlay.classList.remove('open');
    });
  }
}
window.closeSearch = () => document.getElementById('searchOverlay')?.classList.remove('open');

/* ═══════════════════════════════════════════════════════════════
   CART BUTTON
═══════════════════════════════════════════════════════════════ */
function initCartButton() {
  document.getElementById('cartBtn')?.addEventListener('click', () => CartUI.toggle());
}

/* ═══════════════════════════════════════════════════════════════
   ACTIVE NAV
═══════════════════════════════════════════════════════════════ */
function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const links    = document.querySelectorAll('.nav-link');
  if (!sections.length || !links.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = e.target.id;
        links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
      }
    });
  }, { threshold: 0.3 });
  sections.forEach(s => io.observe(s));
}

/* ═══════════════════════════════════════════════════════════════
   COOKIE NOTICE
═══════════════════════════════════════════════════════════════ */
function initCookieNotice() {
  if (localStorage.getItem('broc_cookies_accepted')) return;
  const el = document.getElementById('cookieNotice');
  if (el) setTimeout(() => el.classList.add('show'), 1500);
}
window.acceptCookies = function() {
  localStorage.setItem('broc_cookies_accepted','1');
  const el = document.getElementById('cookieNotice');
  if (el) { el.style.transform='translateY(100%)'; setTimeout(() => el.remove(), 400); }
};

/* ═══════════════════════════════════════════════════════════════
   PRODUCT INDEX (for sort reset)
═══════════════════════════════════════════════════════════════ */
function initProductIndex() {
  document.querySelectorAll('.product-card').forEach((c,i) => { c.dataset.originalIndex = i; });
}

/* ═══════════════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════════════ */
function _e(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}
function escapeHtml(s) { return _e(s); }

/* ═══════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initRevealObserver();
  initCounters();
  initNavScroll();
  initMobileNav();
  initSearch();
  initCartButton();
  initActiveNav();
  initWishlists();
  initProductIndex();
  initCookieNotice();

  /* Pre-build the cart drawer so first open is instant */
  CartUI._build();

  /* Expose globals */
  window.CartUI          = CartUI;
  window.toggleSidebar   = toggleSidebar;
  window.clearEnquiry    = clearEnquiry;
  window.sendEnquiryViaWA= sendEnquiryViaWA;
  window.filterCat       = filterCat;
  window.showAllProducts = showAllProducts;
  window.sortProducts    = sortProducts;
  window.submitEnquiry   = submitEnquiry;
  window.closeSearch     = closeSearch;
  window.showToast       = showToast;
  window.escapeHtml      = escapeHtml;

  console.log('%cArmand Carpentry & Designs', 'font-size:18px;font-weight:bold;color:#5a5a5a;');
  console.log('%cBoards | Cutting | Fittings', 'color:#6a6a6a;');
});

/* ═══════════════════════════════════════════════════════════════
   PRODUCT IMAGE PLACEHOLDER
   Shown whenever a product has no photo yet, or its image URL
   fails to load. Instead of a generic icon it draws a studio-style
   illustration of the kind of item being sold (a cup hinge, a bar
   handle, a padlock, a drawer runner, an LED downlight ...).

   The item is chosen from the product NAME first ("Soft-Close Cup
   Hinge" -> hinge, "Brass Knob" -> knob) and falls back to the
   CATEGORY, so it still works when names are unusual.

   Usage:  brocPlaceholderHTML(category, compact, name)
           <img alt="Name" onerror="brocImgFallback(this,'hinges')">
═══════════════════════════════════════════════════════════════ */
let _brocPhSeq = 0;

/* Category slug (incl. legacy aliases) -> default illustration */
const BROC_PH_CAT_DEFAULT = {
  hinges: 'hinge',   hinge: 'hinge',
  handles: 'handle', handle: 'handle', knobs: 'knob',
  drawers: 'runner', drawer: 'runner',
  locks: 'padlock',  lock: 'padlock',   security: 'padlock',
  kitchen: 'basket',
  lighting: 'light', lights: 'light',
  construction: 'bracket',
  closet: 'rail',    wardrobe: 'rail',
  tools: 'screwdriver', fixings: 'bolt',
  boards: 'boards',  edging: 'edging'
};

/* Product-name keywords, checked in order (most specific first) */
const BROC_PH_NAME_RULES = [
  [/padlock|shackle/i,                                   'padlock'],
  [/cam\s*lock|cabinet lock|cupboard lock|drawer lock|locker/i, 'camlock'],
  [/mortice|mortise|deadbolt|dead\s*bolt|lock\s*set|door lock|rim lock|latch|cylinder|sash\s*lock/i, 'doorlock'],
  [/\block\b|\blocks\b/i,                                'padlock'],
  [/butt hinge|door hinge|piano|flag hinge|strap hinge|t-hinge|gate hinge|ball bearing hinge/i, 'butthinge'],
  [/hinge/i,                                             'hinge'],
  [/knob/i,                                              'knob'],
  [/lever|door handle|entrance handle|passage/i,         'lever'],
  [/basket|pull-?\s?out|carousel|\bbin\b/i,                'basket'],
  [/handle|\bpull\b|d-handle|bar pull/i,                 'handle'],
  [/runner|slide|drawer|tandem|undermount/i,             'runner'],
  [/wardrobe|hanging rail|closet|rail\b|tube/i,          'rail'],
  [/\bled\b|light|lamp|downlight|spot\b|strip/i,         'light'],
  [/edging|edge\s*band|edge tape|banding/i,              'edging'],
  [/screwdriver|driver|drill|tool|spanner|wrench|plier/i,'screwdriver'],
  [/screw|bolt|\bnuts?\b|washer|fixing|fastener|dowel/i, 'bolt'],
  [/board|panel|melamine|\bmdf\b|chipboard|plywood|sheet|laminate/i, 'boards'],
  [/bracket|angle|brace|corner|shelf support/i,          'bracket'],
  [/\bwire\b/i,                                         'basket']
];

function brocPlaceholderType(category, name) {
  const n = String(name || '');
  for (const [re, type] of BROC_PH_NAME_RULES) if (re.test(n)) return type;
  const c = String(category || '').toLowerCase().trim().replace(/[\s&]+/g, '_');
  if (BROC_PH_CAT_DEFAULT[c]) return BROC_PH_CAT_DEFAULT[c];
  for (const k in BROC_PH_CAT_DEFAULT) if (c.indexOf(k) === 0) return BROC_PH_CAT_DEFAULT[k];
  return 'bolt';
}

/* Each drawer returns SVG markup on a 240 x 200 canvas.
   f = fill references (shared metal gradients); E = soft outline. */
const BROC_PH_DRAW = {
  hinge: f => `
    <rect x="176" y="66" width="36" height="68" rx="5" fill="${f.s}" ${f.E}/>
    <circle cx="194" cy="80" r="4.5" fill="#4F4C50"/><circle cx="194" cy="120" r="4.5" fill="#4F4C50"/>
    <rect x="186" y="94" width="16" height="12" rx="2" fill="${f.v}" ${f.E}/>
    <rect x="112" y="91" width="78" height="18" rx="9" fill="${f.v}" ${f.E}/>
    <line x1="122" y1="96" x2="182" y2="96" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>
    <circle cx="190" cy="100" r="6" fill="${f.r}" ${f.E}/>
    <rect x="30" y="54" width="88" height="92" rx="9" fill="${f.s}" ${f.E}/>
    <circle cx="74" cy="100" r="28" fill="${f.r}" ${f.E}/>
    <circle cx="74" cy="100" r="21" fill="#a3a9b1" stroke="#85818A" stroke-opacity=".6"/>
    <circle cx="74" cy="100" r="15" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.5"/>
    <circle cx="74" cy="62" r="5" fill="${f.r}" ${f.E}/><line x1="70.5" y1="62" x2="77.5" y2="62" stroke="#5a6068" stroke-width="1.6"/>
    <circle cx="74" cy="138" r="5" fill="${f.r}" ${f.E}/><line x1="70.5" y1="138" x2="77.5" y2="138" stroke="#5a6068" stroke-width="1.6"/>`,

  butthinge: f => `
    <rect x="42" y="52" width="74" height="96" rx="3" fill="${f.s}" ${f.E}/>
    <rect x="124" y="52" width="74" height="96" rx="3" fill="${f.s}" ${f.E}/>
    <rect x="110" y="48" width="20" height="104" rx="5" fill="${f.s2}" ${f.E}/>
    <line x1="110" y1="76" x2="130" y2="76" stroke="#726E73" stroke-opacity=".7"/>
    <line x1="110" y1="100" x2="130" y2="100" stroke="#726E73" stroke-opacity=".7"/>
    <line x1="110" y1="124" x2="130" y2="124" stroke="#726E73" stroke-opacity=".7"/>
    ${[72, 100, 128].map(y => `
    <circle cx="72" cy="${y}" r="6.5" fill="#c9ced5" stroke="#85818A" stroke-opacity=".6"/><circle cx="72" cy="${y}" r="3.6" fill="#4F4C50"/>
    <circle cx="168" cy="${y}" r="6.5" fill="#c9ced5" stroke="#85818A" stroke-opacity=".6"/><circle cx="168" cy="${y}" r="3.6" fill="#4F4C50"/>`).join('')}`,

  handle: f => `
    <g transform="translate(0,8)">
      <rect x="56" y="88" width="12" height="36" fill="${f.s}" ${f.E}/>
      <rect x="172" y="88" width="12" height="36" fill="${f.s}" ${f.E}/>
      <rect x="49" y="122" width="26" height="9" rx="2" fill="${f.v}" ${f.E}/>
      <rect x="165" y="122" width="26" height="9" rx="2" fill="${f.v}" ${f.E}/>
      <rect x="36" y="72" width="168" height="18" rx="9" fill="${f.v}" ${f.E}/>
      <line x1="50" y1="77" x2="190" y2="77" stroke="#fff" stroke-opacity=".75" stroke-width="2.2" stroke-linecap="round"/>
    </g>`,

  knob: f => `
    <ellipse cx="120" cy="134" rx="34" ry="7" fill="${f.v}" ${f.E}/>
    <rect x="111" y="104" width="18" height="30" fill="${f.s}" ${f.E}/>
    <circle cx="120" cy="82" r="38" fill="${f.r}" ${f.E}/>
    <circle cx="120" cy="82" r="30" fill="none" stroke="#fff" stroke-opacity=".35"/>
    <ellipse cx="106" cy="66" rx="14" ry="8" fill="#fff" fill-opacity=".6" transform="rotate(-32 106 66)"/>`,

  lever: f => `
    <rect x="66" y="90" width="128" height="20" rx="10" fill="${f.v}" ${f.E}/>
    <line x1="88" y1="95" x2="184" y2="95" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>
    <circle cx="72" cy="100" r="34" fill="${f.r}" ${f.E}/>
    <circle cx="72" cy="100" r="25" fill="none" stroke="#fff" stroke-opacity=".4"/>
    <circle cx="72" cy="100" r="11" fill="${f.r}" ${f.E}/>`,

  runner: f => `
    <rect x="18" y="72" width="204" height="28" rx="3" fill="${f.v}" ${f.E}/>
    ${[38, 88, 138, 188].map(x => `<rect x="${x}" y="82" width="24" height="7" rx="3.5" fill="#4F4C50" fill-opacity=".85"/>`).join('')}
    <rect x="36" y="99" width="170" height="6" rx="1" fill="#2f3237"/>
    ${Array.from({ length: 9 }, (_, i) => `<circle cx="${46 + i * 18.5}" cy="102" r="3.7" fill="${f.r}"/>`).join('')}
    <rect x="34" y="104" width="172" height="24" rx="3" fill="${f.s}" ${f.E}/>
    <rect x="204" y="100" width="9" height="34" rx="2" fill="${f.v}" ${f.E}/>
    ${[62, 112, 162].map(x => `<circle cx="${x}" cy="116" r="3.2" fill="#4F4C50" fill-opacity=".8"/>`).join('')}`,

  padlock: f => `
    <path d="M92 98 V70 a28 28 0 0 1 56 0 V98" fill="none" stroke="#9aa0a9" stroke-width="12"/>
    <path d="M92 98 V70 a28 28 0 0 1 56 0 V98" fill="none" stroke="#f3f5f7" stroke-width="3.5" stroke-opacity=".9"/>
    <rect x="66" y="94" width="108" height="76" rx="12" fill="${f.s}" ${f.E}/>
    <rect x="75" y="102" width="90" height="60" rx="8" fill="none" stroke="#fff" stroke-opacity=".55"/>
    <circle cx="120" cy="124" r="8.5" fill="#353236"/>
    <path d="M116 130 L124 130 L127.5 150 L112.5 150 Z" fill="#353236"/>
    <circle cx="82" cy="114" r="2.6" fill="#726E73"/><circle cx="158" cy="114" r="2.6" fill="#726E73"/>`,

  camlock: f => `
    <circle cx="100" cy="90" r="40" fill="${f.r}" ${f.E}/>
    <circle cx="100" cy="90" r="31" fill="${f.s}" ${f.E}/>
    <circle cx="100" cy="90" r="24" fill="none" stroke="#fff" stroke-opacity=".5"/>
    <rect x="95.5" y="70" width="9" height="40" rx="4.5" fill="#2f3237"/>
    <circle cx="100" cy="90" r="6.5" fill="#43474d"/>
    <circle cx="176" cy="150" r="9" fill="none" stroke="#a6acb5" stroke-width="5" ${f.E}/>
    <rect x="184" y="147" width="36" height="6.5" rx="1.5" fill="${f.v}" ${f.E}/>
    <rect x="204" y="152" width="5" height="6" fill="${f.v}"/><rect x="213" y="152" width="5" height="9" fill="${f.v}"/>`,

  doorlock: f => `
    <rect x="164" y="52" width="14" height="100" rx="2" fill="${f.v}" ${f.E}/>
    <rect x="178" y="66" width="24" height="20" rx="3" fill="${f.s}" ${f.E}/>
    <rect x="178" y="112" width="24" height="20" rx="3" fill="${f.v}" ${f.E}/>
    <circle cx="171" cy="60" r="2.8" fill="#4F4C50"/><circle cx="171" cy="144" r="2.8" fill="#4F4C50"/>
    <rect x="44" y="52" width="122" height="100" rx="5" fill="${f.s}" ${f.E}/>
    <rect x="54" y="62" width="102" height="80" rx="3" fill="none" stroke="#fff" stroke-opacity=".5"/>
    <circle cx="96" cy="88" r="8" fill="#353236"/>
    <path d="M92.5 93 L99.5 93 L102 110 L90 110 Z" fill="#353236"/>
    <circle cx="128" cy="118" r="12" fill="${f.r}" ${f.E}/><rect x="124.5" y="112" width="7" height="12" fill="#353236"/>`,

  basket: f => `
    <rect x="34" y="88" width="9" height="22" rx="2" fill="${f.s}" ${f.E}/>
    <rect x="197" y="88" width="9" height="22" rx="2" fill="${f.s}" ${f.E}/>
    ${[60, 74, 88, 102, 116, 130, 144, 158, 172, 186].map(x => `<line x1="${x}" y1="70" x2="${x}" y2="150" stroke="#c4c9d0" stroke-width="2.6"/>`).join('')}
    ${[92, 114, 134].map(y => `<line x1="44" y1="${y}" x2="196" y2="${y}" stroke="#b3b9c1" stroke-width="2.6"/>`).join('')}
    <rect x="42" y="66" width="156" height="86" rx="6" fill="none" stroke="#a9afb8" stroke-width="4.5"/>
    <rect x="38" y="56" width="164" height="12" rx="6" fill="${f.v}" ${f.E}/>
    <line x1="48" y1="60" x2="192" y2="60" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>`,

  light: f => `
    <rect x="56" y="88" width="20" height="18" rx="2" fill="${f.v}" ${f.E}/>
    <rect x="164" y="88" width="20" height="18" rx="2" fill="${f.v}" ${f.E}/>
    <circle cx="120" cy="98" r="54" fill="${f.r}" ${f.E}/>
    <circle cx="120" cy="98" r="45" fill="#d5d9de" stroke="#8f959e" stroke-opacity=".5"/>
    <circle cx="120" cy="98" r="39" fill="${f.lens}"/>
    ${Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3; return `<circle cx="${(120 + 21 * Math.cos(a)).toFixed(1)}" cy="${(98 + 21 * Math.sin(a)).toFixed(1)}" r="3" fill="#fffdf0" stroke="#f0c94a" stroke-width=".8"/>`; }).join('')}
    <circle cx="120" cy="98" r="5" fill="#fffdf0" stroke="#f0c94a" stroke-width=".8"/>`,

  bracket: f => `
    <path d="M62 42 H92 V126 H186 V158 H62 Z" fill="${f.s}" ${f.E}/>
    <path d="M92 84 V126 H148 Z" fill="#c1c6cd" ${f.E}/>
    <ellipse cx="77" cy="64" rx="5.5" ry="9" fill="#4F4C50"/><ellipse cx="77" cy="100" rx="5.5" ry="9" fill="#4F4C50"/>
    <ellipse cx="116" cy="142" rx="9" ry="5.5" fill="#4F4C50"/><ellipse cx="160" cy="142" rx="9" ry="5.5" fill="#4F4C50"/>
    <line x1="66" y1="46" x2="66" y2="150" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>`,

  rail: f => `
    <rect x="52" y="93" width="136" height="14" rx="7" fill="${f.v}" ${f.E}/>
    <line x1="60" y1="97" x2="180" y2="97" stroke="#fff" stroke-opacity=".75" stroke-width="2" stroke-linecap="round"/>
    <rect x="28" y="66" width="16" height="68" rx="3" fill="${f.s}" ${f.E}/>
    <rect x="196" y="66" width="16" height="68" rx="3" fill="${f.s}" ${f.E}/>
    <rect x="44" y="86" width="18" height="28" rx="4" fill="${f.s2}" ${f.E}/>
    <rect x="178" y="86" width="18" height="28" rx="4" fill="${f.s2}" ${f.E}/>
    <circle cx="36" cy="76" r="3.2" fill="#4F4C50"/><circle cx="36" cy="124" r="3.2" fill="#4F4C50"/>
    <circle cx="204" cy="76" r="3.2" fill="#4F4C50"/><circle cx="204" cy="124" r="3.2" fill="#4F4C50"/>`,

  screwdriver: f => `
    <g transform="rotate(-24 122 100)">
      <rect x="28" y="84" width="76" height="32" rx="14" fill="${f.d}"/>
      ${[44, 58, 72, 86].map(x => `<line x1="${x}" y1="88" x2="${x}" y2="112" stroke="#0d0e10" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>`).join('')}
      <line x1="38" y1="90" x2="96" y2="90" stroke="#9aa0a8" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>
      <rect x="24" y="90" width="8" height="20" rx="3" fill="${f.v}" ${f.E}/>
      <rect x="102" y="90" width="16" height="20" rx="3" fill="${f.v}" ${f.E}/>
      <rect x="118" y="96.5" width="92" height="7" rx="3" fill="${f.v}" ${f.E}/>
      <polygon points="208,96 226,98.5 226,101.5 208,104" fill="${f.v}" ${f.E}/>
    </g>`,

  bolt: f => `
    <g transform="rotate(-16 122 100)">
      <rect x="42" y="76" width="32" height="48" rx="3" fill="${f.v}" ${f.E}/>
      <line x1="58" y1="76" x2="58" y2="124" stroke="#85818A" stroke-opacity=".6"/>
      <rect x="74" y="72" width="7" height="56" rx="2" fill="${f.s}" ${f.E}/>
      <rect x="81" y="88" width="112" height="24" fill="${f.v}" ${f.E}/>
      ${Array.from({ length: 13 }, (_, i) => `<line x1="${92 + i * 8}" y1="88" x2="${98 + i * 8}" y2="112" stroke="#85818A" stroke-width="1.6" stroke-opacity=".8"/>`).join('')}
      <polygon points="193,88 208,93 208,107 193,112" fill="${f.s}" ${f.E}/>
    </g>`,

  boards: f => {
    const edge = (dy, l, r) => `
      <polygon points="50,${70 + dy} 100,${84 + dy} 100,${96 + dy} 50,${82 + dy}" fill="${l}" stroke="#000" stroke-opacity=".12"/>
      <polygon points="100,${84 + dy} 200,${62 + dy} 200,${74 + dy} 100,${96 + dy}" fill="${r}" stroke="#000" stroke-opacity=".12"/>`;
    const top = (dy, fill) => `<polygon points="50,${70 + dy} 150,${48 + dy} 200,${62 + dy} 100,${84 + dy}" fill="${fill}" stroke="#000" stroke-opacity=".14"/>`;
    const grain = [0.18, 0.36, 0.54, 0.72, 0.9].map(t => {
      const x = 50 + 50 * t, y = 70 + 14 * t + 20;
      return `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + 100).toFixed(1)}" y2="${(y - 22).toFixed(1)}" stroke="#b98d55" stroke-opacity=".55" stroke-width="1.2"/>`;
    }).join('');
    return `<g transform="translate(-4,0)">
      ${edge(44, '#8b9098', '#6f747c')}${top(44, '#a3a8af')}
      ${edge(32, '#f3f3f1', '#d9d9d5')}${top(32, '#fbfbf9')}
      ${edge(20, '#d3ab72', '#b98f57')}${top(20, '#dfbd8b')}${grain}
    </g>`;
  },

  edging: f => `
    <rect x="96" y="150" width="118" height="8" rx="1.5" fill="#9AA3AD" stroke="#a98554" stroke-opacity=".7"/>
    <line x1="100" y1="152.5" x2="210" y2="152.5" stroke="#fff" stroke-opacity=".4"/>
    <circle cx="96" cy="98" r="54" fill="#9AA3AD" stroke="#a98554" stroke-opacity=".8"/>
    <circle cx="96" cy="98" r="46" fill="none" stroke="#b98f5a" stroke-opacity=".6"/>
    <circle cx="96" cy="98" r="38" fill="none" stroke="#b98f5a" stroke-opacity=".6"/>
    <circle cx="96" cy="98" r="30" fill="none" stroke="#b98f5a" stroke-opacity=".6"/>
    <circle cx="96" cy="98" r="22" fill="#c7b596" stroke="#9a8b72"/>
    <circle cx="96" cy="98" r="11" fill="#f1f2f4" stroke="#9a8b72"/>
    <path d="M56 78 A46 46 0 0 1 96 52" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>`
};

function _brocPhEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function brocPlaceholderSVG(type) {
  const u = 'bph' + (++_brocPhSeq) + '-';
  const draw = BROC_PH_DRAW[type] || BROC_PH_DRAW.bolt;
  const f = {
    s: `url(#${u}s)`, s2: `url(#${u}s2)`, v: `url(#${u}v)`, d: `url(#${u}d)`, r: `url(#${u}r)`,
    lens: `url(#${u}lens)`,
    E: 'stroke="#79808a" stroke-opacity=".55" stroke-width=".8"'
  };
  const glow = type === 'light'
    ? `<circle cx="120" cy="98" r="86" fill="url(#${u}glow)"/>` : '';
  return `<svg viewBox="8 26 224 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" style="position:absolute;left:0;top:0;width:100%;height:100%;display:block;">
    <defs>
      <linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbfcfd"/><stop offset=".38" stop-color="#c7ccd3"/><stop offset=".58" stop-color="#eef0f3"/><stop offset="1" stop-color="#8e949d"/></linearGradient>
      <linearGradient id="${u}s2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9ecef"/><stop offset=".5" stop-color="#aab0b8"/><stop offset="1" stop-color="#d7dbe0"/></linearGradient>
      <linearGradient id="${u}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfdfe"/><stop offset=".32" stop-color="#d3d7dd"/><stop offset=".72" stop-color="#98a0a9"/><stop offset="1" stop-color="#e4e7eb"/></linearGradient>
      <linearGradient id="${u}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d6065"/><stop offset=".5" stop-color="#2b2d31"/><stop offset="1" stop-color="#17181a"/></linearGradient>
      <radialGradient id="${u}r" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#d9dde2"/><stop offset="1" stop-color="#8a9099"/></radialGradient>
      <radialGradient id="${u}lens" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#fff5cc"/><stop offset="1" stop-color="#ffe08a"/></radialGradient>
      <radialGradient id="${u}glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".65"/><stop offset="1" stop-color="#ffe9a0" stop-opacity="0"/></radialGradient>
      <filter id="${u}sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#2a282b" flood-opacity=".22"/></filter>
    </defs>
    ${glow}
    <g filter="url(#${u}sh)">${draw(f)}</g>
  </svg>`;
}

/* ── PLACEHOLDER TILE ─────────────────────────────────────────
   One consistent monoline icon per category on a light drafting-grid
   tile. Deliberately generic: it never pretends to show the product. */
const BROC_PH_ICONS = {
  hinges:       ['Hinges & pivots',   '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/><path d="M10 7h4M10 12h4M10 17h4"/><circle cx="6.5" cy="8" r=".6"/><circle cx="6.5" cy="16" r=".6"/><circle cx="17.5" cy="8" r=".6"/><circle cx="17.5" cy="16" r=".6"/>'],
  handles:      ['Handles & knobs',   '<path d="M6 14V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5"/><path d="M6 14v4M18 14v4"/><path d="M3 20h18"/>'],
  drawers:      ['Drawer systems',    '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 12h18M10 8h4M10 16h4"/>'],
  locks:        ['Locks & security',  '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="16" r="1"/>'],
  kitchen:      ['Kitchen fittings',  '<path d="M7 4h6a3 3 0 0 1 3 3v2"/><path d="M7 4v5"/><path d="M3 13h18l-1.5 6a2 2 0 0 1-2 1.5h-11a2 2 0 0 1-2-1.5z"/>'],
  lighting:     ['Lighting hardware', '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'],
  construction: ['Construction',       '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 15h18M9 5v5M15 10v5M9 15v4"/>'],
  closet:       ['Closet systems',    '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M10 12v2M14 12v2"/>'],
  tools:        ['Tools & fixings',   '<path d="M7 3h10v4H7z"/><path d="M9 7v13l3 1.5 3-1.5V7"/><path d="M9 11h6M9 15h6"/>'],
  boards:       ['Boards & panels',   '<path d="M3 8l9-4 9 4-9 4z"/><path d="M3 12l9 4 9-4"/><path d="M3 16l9 4 9-4"/>'],
  edging:       ['Edging',            '<circle cx="10" cy="11" r="7"/><circle cx="10" cy="11" r="2.5"/><path d="M10 18h10"/>'],
  generic:      ['Product',           '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>']
};
const BROC_PH_MATCH = [
  [/hinge|pivot/,'hinges'],[/handle|knob|pull/,'handles'],[/drawer|runner|slide/,'drawers'],
  [/lock|secur|latch/,'locks'],[/kitchen|sink|tap|basket/,'kitchen'],[/light|lamp|led/,'lighting'],
  [/construct|brick|anchor/,'construction'],[/closet|wardrobe|rail/,'closet'],
  [/tool|fix|screw|bolt|bit|drill/,'tools'],[/board|panel|melamine|wood|granite/,'boards'],[/edg/,'edging']
];
function brocPlaceholderKey(category, name) {
  const c = String(category || '').toLowerCase();
  for (const [re, k] of BROC_PH_MATCH) if (re.test(c)) return k;
  const n = String(name || '').toLowerCase();
  for (const [re, k] of BROC_PH_MATCH) if (re.test(n)) return k;
  return 'generic';
}

function brocPlaceholderHTML(category, compact, name) {
  const key   = brocPlaceholderKey(category, name);
  const [label, paths] = BROC_PH_ICONS[key];
  const aria  = _brocPhEsc((name || 'Product') + ' — photo to follow');
  const grid  = 'background-color:#f3f5f7;'
              + 'background-image:linear-gradient(rgba(95,104,114,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(95,104,114,.08) 1px,transparent 1px),linear-gradient(180deg,#fafbfc,#e9ecef);'
              + 'background-size:22px 22px,22px 22px,100% 100%;';
  const icon  = (px) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="#5f6872" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  if (compact) {
    return `<div class="broc-img-ph broc-img-ph--compact" role="img" aria-label="${aria}" data-ph="${key}" style="position:absolute;inset:0;${grid}display:flex;align-items:center;justify-content:center;">${icon(26)}</div>`;
  }
  return `<div class="broc-img-ph" role="img" aria-label="${aria}" data-ph="${key}" style="position:absolute;inset:0;${grid}display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;overflow:hidden;">
    <span style="display:flex;align-items:center;justify-content:center;width:84px;height:84px;border-radius:50%;background:#fff;border:1px solid #dfe3e7;box-shadow:0 6px 16px -8px rgba(30,34,40,.25);">${icon(40)}</span>
    <span style="font-family:'Barlow Semi Condensed','Barlow',sans-serif;font-size:11px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:#6b747e;">${_brocPhEsc(label)}</span>
  </div>`;
}

/* Call from an <img onerror="brocImgFallback(this,'hinges')">
   to swap a broken/inaccessible image URL for the placeholder live.
   The product name is read from the image's alt text. */
function brocImgFallback(imgEl, category, compact) {
  if (!imgEl || imgEl.dataset.brocFallbackApplied) return;
  imgEl.dataset.brocFallbackApplied = '1';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;';
  wrap.innerHTML = brocPlaceholderHTML(category, compact, imgEl.alt);
  imgEl.replaceWith(wrap);
}
window.brocPlaceholderHTML = brocPlaceholderHTML;
window.brocPlaceholderType = brocPlaceholderType;
window.brocPlaceholderKey  = brocPlaceholderKey;
window.brocImgFallback     = brocImgFallback;
