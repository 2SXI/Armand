/**
 * ARMAND CARPENTRY & DESIGNS — armand-shop.js  v2.0
 * ════════════════════════════════════════════════════════════════
 * ADDITIVE EXTENSION — does NOT modify existing app.js or HTML
 *
 * BUG FIXES (v2.0):
 *   - Event delegation for Add-to-Cart (works with dynamic Supabase products)
 *   - Products cached in window.products for global access
 *   - Cart no longer conflicts with app.js enquiry system
 *   - app.js Supabase credentials patched at runtime
 *   - Sidebar renderSidebar() safely overrides renderSidebarList()
 *
 * PHASES:
 *   Phase 1 : Product system   — fetch + render from Supabase
 *   Phase 2 : Cart system      — add/remove/qty, localStorage
 *   Phase 3 : Checkout system  — multi-step form, order to Supabase
 *   Phase 4 : WhatsApp         — post-checkout WA confirmation
 *   Phase 5 : Paynow Zimbabwe  — EcoCash / OneMoney / card via Paynow
 *   Phase 6 : PayPal           — PayPal SDK checkout button
 * ════════════════════════════════════════════════════════════════
 * REQUIRED in index.html (ONLY these 2 additions):
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <script src="armand-shop.js"></script>
 *
 * ════════════════════════════════════════════════════════════════
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   CONFIGURATION — edit these values
───────────────────────────────────────────────────────────────*/
const SHOP = {
  supabaseUrl  : 'https://nasbxjharopveynnwgrg.supabase.co',
  supabaseKey  : 'sb_publishable_io0oLODozq0xdUJiNT37tQ_u2PWURX0',
  waNumber     : '263780793585',   // no + prefix
  currency     : 'USD',
  storageKey   : 'broc_cart_v1',

  /* ── Paynow Zimbabwe ──────────────────────────────────────
     Get your integration ID and key from https://www.paynow.co.zw
     Set returnUrl to your live domain once deployed.
     Paynow requires a server-side component to initiate payments
     securely. This frontend code calls YOUR serverless function
     (see netlify/functions/paynow-init.js included below).
     For local testing set paynowEnabled: false to use mock.      */
  paynow: {
    enabled       : false,           // ← set true once server function is deployed
    integrationId : 'YOUR_PAYNOW_INTEGRATION_ID',
    integrationKey: 'YOUR_PAYNOW_INTEGRATION_KEY',
    returnUrl     : 'https://armand.co.zw/?payment=success',
    resultUrl     : 'https://armand.co.zw/.netlify/functions/paynow-result',
    // This endpoint is your Netlify/Vercel function that POSTs to Paynow:
    initEndpoint  : '/.netlify/functions/paynow-init',
  },

  /* ── PayPal ───────────────────────────────────────────────
     Get your client ID from https://developer.paypal.com
     Use sandbox client ID during testing.                          */
  paypal: {
    enabled     : false,             // ← set true when you have a client ID
    clientId    : 'YOUR_PAYPAL_CLIENT_ID',
    currency    : 'USD',
    intent      : 'capture',
  },
};


/* ─────────────────────────────────────────────────────────────
   SUPABASE CLIENT
───────────────────────────────────────────────────────────────*/
let _sb = null;
function getSB() {
  if (_sb) return _sb;
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    _sb = supabase.createClient(SHOP.supabaseUrl, SHOP.supabaseKey);
  }
  return _sb;
}

/** Generic REST helper (fallback when SDK not available) */
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SHOP.supabaseUrl}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey'       : SHOP.supabaseKey,
      'Authorization': `Bearer ${SHOP.supabaseKey}`,
      'Content-Type' : 'application/json',
      'Prefer'       : 'return=representation',
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`);
  return body;
}

/** Place an order through the server-side place_order() function.
 *  Prices, totals, stock and status are decided by the database, never the browser. */
async function placeOrderServer({ name, phone, address, notes, method }) {
  const args = {
    p_name   : name,
    p_phone  : phone,
    p_address: address || null,
    p_notes  : notes   || null,
    p_method : method,
    p_items  : Cart._items.map(i => ({ id: i.id, qty: i.qty || 1 })),
  };
  const sb = getSB();
  if (sb) {
    const { data, error } = await sb.rpc('place_order', args);
    if (error) throw new Error(error.message);
    return data;
  }
  return await sbFetch('rpc/place_order', { method: 'POST', body: JSON.stringify(args) });
}

/* ─────────────────────────────────────────────────────────────
   BUG FIX: Patch app.js's hardcoded placeholder Supabase creds
   so the enquiry form actually works.
───────────────────────────────────────────────────────────────*/
function patchAppJsSupabase() {
  // app.js declares SUPABASE_URL / SUPABASE_ANON_KEY as globals
  // Override them if they still have placeholder values:
  if (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
    try {
      // eslint-disable-next-line no-global-assign
      window.SUPABASE_URL     = SHOP.supabaseUrl;
      window.SUPABASE_ANON_KEY = SHOP.supabaseKey;
    } catch(e) { /* silent */ }
  }
}


/* ═════════════════════════════════════════════════════════════
   PHASE 1 — PRODUCT SYSTEM
═════════════════════════════════════════════════════════════ */

const CAT_MAP = {
  hinges       : 'hinges',
  handles      : 'handles',
  knobs        : 'handles',
  drawers      : 'drawers',
  locks        : 'locks',
  security     : 'locks',
  kitchen      : 'kitchen',
  lighting     : 'lighting',
  construction : 'construction',
  closet       : 'closet',
  tools        : 'tools',
  fixings      : 'tools',
};

function normaliseCat(raw = '') {
  const key = raw.toLowerCase().trim().replace(/\s+/g, '_');
  return CAT_MAP[key] || key;
}

function stockLabel(stock) {
  if (stock === null || stock === undefined) return '';
  if (stock === 0) return '<span class="pc-badge sale" style="top:auto;bottom:12px;left:12px;">OUT OF STOCK</span>';
  if (stock <= 10) return `<span class="pc-badge trade" style="top:auto;bottom:12px;left:12px;">LOW STOCK: ${stock}</span>`;
  return '';
}

/**
 * Build a product card using the EXACT same structure as index.html.
 * BUG FIX: buttons use data attributes only — no inline onclick with IDs.
 * Event delegation handles clicks via the grid listener (see initCartDelegation).
 */
const SHOP_CAT_LABELS = {hinges:'Hinges & pivots',handles:'Handles & knobs',drawers:'Drawer systems',locks:'Locks & security',kitchen:'Kitchen fittings',lighting:'Lighting hardware',construction:'Construction',closet:'Closet systems',tools:'Tools & fixings',boards:'Boards & panels',edging:'Edging'};

function buildProductCard(p) {
  const cat      = normaliseCat(p.category);
  const price    = parseFloat(p.price || 0).toFixed(2);
  const imgHtml  = p.image
    ? `<img src="${escSH(p.image)}" alt="${escSH(p.name)}" class="pc-img-photo" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" onerror="brocImgFallback(this,'${escSH(p.category||'')}')">`
    : brocPlaceholderHTML(p.category, false, p.name);
  const outOfStock = (p.stock === 0);

  return `
<div class="product-card" data-cat="${cat}" data-product-id="${p.id}" data-price="${price}" data-name="${escSH(p.name)}">
  <a href="product.html?id=${p.id}" class="pc-img-link" aria-label="View ${escSH(p.name)}" style="display:block;position:relative;overflow:hidden;text-decoration:none;">
    <div class="pc-img" style="position:relative;">
      ${imgHtml}
      ${p.badge ? `<span class="pc-badge ${escSH(p.badge.toLowerCase())}">${escSH(p.badge.toUpperCase())}</span>` : ''}
      ${stockLabel(p.stock)}
      <button class="pc-wishlist" aria-label="Save ${escSH(p.name)}" onclick="event.preventDefault();event.stopPropagation();">♡</button>
    </div>
  </a>
  <div class="pc-body">
    <div class="pc-cat">${escSH(SHOP_CAT_LABELS[cat] || p.category || '')}</div>
    <a href="product.html?id=${p.id}" class="pc-name-link" style="text-decoration:none;color:inherit;display:block;">
      <div class="pc-name">${escSH(p.name)}</div>
    </a>
    <div class="pc-spec">${escSH(p.short_description || p.description || '')}</div>
    <div class="pc-price-row">
      <div>
        <span class="pc-price">${SHOP.currency} ${price}</span>
        ${p.old_price ? `<span class="pc-price-old">${SHOP.currency} ${parseFloat(p.old_price).toFixed(2)}</span>` : ''}
      </div>
      <button
        class="pc-add broc-add-btn"
        data-pid="${p.id}"
        ${outOfStock ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}
        aria-label="Add ${escSH(p.name)} to cart"
      ><span>Add</span><span class="pc-add-plus" aria-hidden="true">+</span></button>
    </div>
    <div class="pc-sku">SKU ${escSH(p.sku || `ARM-${p.id}`)}</div>
    <button
      class="pc-cart-full broc-add-btn"
      data-pid="${p.id}"
      ${outOfStock ? 'disabled style="opacity:.4;"' : ''}
    >${outOfStock ? 'Out of Stock' : 'Add to Cart'}</button>
  </div>
</div>`;
}

/**
 * BUG FIX: Use event delegation on the products grid so that
 * dynamically rendered cards get working Add-to-Cart buttons
 * without relying on inline onclick= attributes.
 */
function initCartDelegation() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.broc-add-btn');
    if (!btn || btn.disabled) return;
    e.stopPropagation();

    const pid = btn.dataset.pid;
    if (pid) Cart.add(pid, e);
  });
}

/**
 * Replace static product grid content with live Supabase data.
 * On homepage (index.html): fetches ONLY featured products (featured=true).
 * Safe to call on any page — returns early if #productsGrid doesn't exist.
 */
async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return; // not on a page with a product grid — bail out

  /* ── Skeleton loaders while fetching ─────────────────────────── */
  grid.innerHTML = Array(8).fill(0).map((_, i) => `
    <div class="product-card" style="pointer-events:none;opacity:.6;">
      <div class="pc-img" style="background:linear-gradient(90deg,var(--gray-100,#eaecef) 25%,var(--gray-200,#d2d6db) 50%,var(--gray-100,#eaecef) 75%);background-size:200% 100%;animation:brocPulse 1.4s ease-in-out infinite ${i * 0.1}s;"></div>
      <div class="pc-body">
        <div style="height:9px;width:55%;background:var(--gray-100,#eaecef);margin-bottom:10px;"></div>
        <div style="height:15px;width:88%;background:var(--gray-100,#eaecef);margin-bottom:8px;"></div>
        <div style="height:11px;width:66%;background:var(--gray-100,#eaecef);"></div>
      </div>
    </div>`).join('');

  try {
    let products = [];
    const sb = getSB();

    if (sb) {
      // ── Try featured=true first (homepage shows ONLY featured products) ──
      const { data: featData, error: featErr } = await sb
        .from('products')
        .select('*')
        .eq('active', true)
        .eq('featured', true)
        .order('name', { ascending: true });

      if (!featErr && featData && featData.length > 0) {
        // Has a featured column and has featured products
        products = featData;
      } else {
        // featured column may not exist, or no products flagged featured yet.
        // Fall back: fetch active products and filter by badge or featured field client-side.
        const { data: allActive, error: allErr } = await fetchAllRows(() => sb
          .from('products')
          .select('*')
          .eq('active', true)
          .order('name', { ascending: true })
          .order('id', { ascending: true }));

        if (allErr) throw allErr;
        const all = allActive || [];

        // Prefer products explicitly marked featured, then those with badges (New/Hot/Sale)
        const featured = all.filter(p => p.featured === true || !!p.badge);
        products = featured.length > 0 ? featured : all.slice(0, 8);
      }
    } else {
      /* REST fallback */
      try {
        const raw = await sbFetch('products?select=*&active=eq.true&featured=eq.true&order=name.asc');
        products = Array.isArray(raw) ? raw : [];
      } catch (_e) {
        const raw = await sbFetch('products?select=*&active=eq.true&order=name.asc');
        const all = Array.isArray(raw) ? raw : [];
        const featured = all.filter(p => p.featured === true || !!p.badge);
        products = featured.length > 0 ? featured : all.slice(0, 8);
      }
    }

    if (!products || products.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:80px 20px;">
          <div style="font-family:'Saira',sans-serif;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--navy,#2a282b);margin-bottom:8px;">No featured products yet</div>
          <p style="font-size:13px;color:var(--muted,#6a6a6a);margin-bottom:20px;">Mark products as featured in the admin panel, or <a href="contact.html" style="color:#9a9a9a;">contact us</a> for our full catalogue.</p>
          <a href="products.html" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:var(--navy,#2a282b);color:#fff;font-family:'Saira',sans-serif;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-decoration:none;margin-right:8px;">View All Products →</a>
          <a href="https://wa.me/${SHOP.waNumber}" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:#CC4A14;color:#fff;font-family:'Saira',sans-serif;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">WhatsApp for Stock List</a>
        </div>`;
      return;
    }

    /* ── Cache globally so cart lookups work without re-fetching ─── */
    // Merge into Products.cache without duplicating existing entries
    products.forEach(p => {
      if (!Products.cache.find(c => String(c.id) === String(p.id))) {
        Products.cache.push(p);
      }
    });
    window.products = Products.cache;

    /* ── Render cards ────────────────────────────────────────────── */
    grid.innerHTML = products.map(buildProductCard).join('');

    /* ── Tag original sort index for client-side re-sort ─────────── */
    grid.querySelectorAll('.product-card').forEach((card, i) => {
      card.dataset.originalIndex = i;
    });

    /* ── Sync cart badge + UI ─────────────────────────────────────── */
    Cart.syncUI();

    /* ── Wishlist delegation (works for dynamically rendered cards) ─ */
    if (typeof initWishlists === 'function') initWishlists();

    /* ── Update category count pills in nav bar ──────────────────── */
    updateCatCounts(products);

    /* ── Notify CartUI to refresh count badge ────────────────────── */
    if (typeof CartUI !== 'undefined' && typeof CartUI.syncCount === 'function') {
      CartUI.syncCount();
    }



  } catch (err) {
    console.error('[Armand] Product load failed:', err);
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:80px 20px;">
        <div style="font-family:'Saira',sans-serif;font-size:16px;font-weight:800;text-transform:uppercase;color:var(--navy,#2a282b);margin-bottom:8px;">Could not load products</div>
        <p style="font-size:13px;color:var(--muted,#6a6a6a);margin-bottom:8px;">${escSH(err.message) || 'Network error'}</p>
        <a href="https://wa.me/${SHOP.waNumber}" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:var(--navy,#2a282b);color:#fff;font-family:'Saira',sans-serif;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">WhatsApp for Stock →</a>
      </div>`;
  }
}

const Products = {
  cache: [],
  getById(id) { return this.cache.find(p => String(p.id) === String(id)); },
};

/* Supabase returns at most 1000 rows per request — page through them all. */
async function fetchAllRows(build) {
  const size = 1000; let all = [], from = 0;
  while (true) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) return { data: null, error };
    all = all.concat(data || []);
    if (!data || data.length < size) break;
    from += size;
  }
  return { data: all, error: null };
}

function updateCatCounts(products) {
  document.querySelectorAll('.cat-btn[data-cat]').forEach(btn => {
    const cat = btn.dataset.cat;
    if (cat === 'all') {
      const badge = btn.querySelector('.cb-count');
      if (badge) badge.textContent = products.length;
      return;
    }
    const count = products.filter(p => normaliseCat(p.category) === cat).length;
    const badge = btn.querySelector('.cb-count');
    if (badge) badge.textContent = count || '0';
  });
}


/* ═════════════════════════════════════════════════════════════
   PHASE 2 — CART SYSTEM
   BUG FIX: Cart.renderSidebar() overrides app.js renderSidebarList()
   so both systems don't fight. app.js enquiry state is bypassed
   when armand-shop.js is loaded.
═════════════════════════════════════════════════════════════ */
const Cart = {
  _items: [],

  /* ── persistence ─────────────────────────────────────────── */
  load() {
    try {
      const raw = localStorage.getItem(SHOP.storageKey);
      this._items = raw ? JSON.parse(raw) : [];
    } catch { this._items = []; }
    this.syncUI();
    this.renderSidebar();
  },

  save() {
    localStorage.setItem(SHOP.storageKey, JSON.stringify(this._items));
  },

  /* ── mutations ───────────────────────────────────────────── */
  add(productId, event) {
    if (event) event.stopPropagation();

    // BUG FIX: Always try Products.cache first (populated after load)
    const product = Products.getById(productId);
    if (product) {
      this._addItem({
        id   : String(product.id),
        name : product.name,
        price: parseFloat(product.price || 0),
        image: product.image || null,
      });
    } else {
      // Fallback: read from card DOM (handles edge case before cache loads)
      const btn  = event?.target?.closest('.broc-add-btn') || event?.target;
      const card = btn?.closest('.product-card');
      if (!card) { console.warn('[Armand Cart] Product not found:', productId); return; }
      this._addItem({
        id   : String(card.dataset.productId || productId),
        name : card.dataset.name || card.querySelector('.pc-name')?.textContent?.trim() || 'Product',
        price: parseFloat(card.dataset.price || 0),
        image: card.querySelector('.pc-img-photo')?.src || null,
      });
    }

    this.save();
    this.syncUI();
    this.renderSidebar();
    this._feedbackBtn(event?.target);
    shopToast('Added to cart ✓');
  },

  _addItem({ id, name, price, image }) {
    const existing = this._items.find(i => String(i.id) === String(id));
    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      this._items.push({ id: String(id), name, price, qty: 1, image: image || null });
    }
  },

  remove(id) {
    this._items = this._items.filter(i => String(i.id) !== String(id));
    this.save();
    this.syncUI();
    this.renderSidebar();
  },

  updateQty(id, delta) {
    const item = this._items.find(i => String(i.id) === String(id));
    if (!item) return;
    item.qty = Math.max(1, (item.qty || 1) + delta);
    this.save();
    this.syncUI();
    this.renderSidebar();
  },

  clear() {
    this._items = [];
    this.save();
    this.syncUI();
    this.renderSidebar();
  },

  /* ── computed ────────────────────────────────────────────── */
  get total() {
    return this._items.reduce((sum, i) => sum + (i.price * (i.qty || 1)), 0);
  },
  get count() {
    return this._items.reduce((sum, i) => sum + (i.qty || 1), 0);
  },

  /* ── UI sync ─────────────────────────────────────────────── */
  syncUI() {
    if (typeof CartUI !== 'undefined') { CartUI.syncCount?.(); }
    const counter = document.getElementById('cartCount');
    if (counter) {
      counter.textContent = this.count;
      counter.style.background = this.count > 0 ? '#fff' : 'rgba(255,255,255,0.25)';
    }
    // BUG FIX: Also override app.js's enquiryItems count display
    if (typeof updateCartUI === 'function') {
      // Suppress app.js counter (it uses enquiryItems.length which stays 0)
      // Our counter above already updated #cartCount — that's enough.
    }
  },

  renderSidebar() {
    // Delegate to CartUI popup drawer
    if (typeof CartUI !== 'undefined') { CartUI.refresh(); }
  },

  sendViaWhatsApp() {
    if (!this._items.length) { shopToast('Your cart is empty!'); return; }
    const lines = this._items.map(i => '  - ' + i.name + ' x' + i.qty + ' @ ' + SHOP.currency + ' ' + (i.price * i.qty).toFixed(2)).join('\n');
    const msg = 'Hello Armand Carpentry & Designs! I would like to place the following order:\n\n' + lines + '\n\nTotal: ' + SHOP.currency + ' ' + this.total.toFixed(2) + '\n\nPlease confirm availability. Thank you.';
    window.open('https://wa.me/' + SHOP.waNumber + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  },

  _feedbackBtn(btn) {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = '✓';
    btn.style.background = '#F36523';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
    }, 1400);
  },
};

/** Cart interactions are handled by CartUI in app.js via event delegation on #brocCartDrawer.
    This stub keeps any callers working without error. */
function initSidebarDelegation() { /* no-op — handled by CartUI */ }


/* ═════════════════════════════════════════════════════════════
   PHASE 3 — CHECKOUT SYSTEM (multi-step modal)
   Steps: 1=Payment method  2=Details+summary  3=Success
═════════════════════════════════════════════════════════════ */
const CK_X = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const CK_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const ckMoney = n => SHOP.currency + ' ' + Number(n || 0).toFixed(2);
const Checkout = {
  _lastOrder : null,

  _methods() {
    const m = [
      { value:'EcoCash',             label:'EcoCash',             desc:'Mobile money' },
      { value:'OneMoney',            label:'OneMoney',            desc:'NetOne mobile money' },
      { value:'Bank Transfer / EFT', label:'Bank transfer / EFT', desc:'Direct bank payment' },
      { value:'Cash on Delivery',    label:'Pay on collection or delivery', desc:'Cash when you receive your order' },
    ];
    if (SHOP.paynow.enabled) m.unshift({ value:'Paynow', label:'Paynow', desc:'EcoCash, Visa or Mastercard online' });
    if (SHOP.paypal.enabled) m.push({ value:'PayPal', label:'PayPal', desc:'PayPal balance or international card' });
    return m;
  },

  mount() {
    if (document.getElementById('broc-checkout-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'broc-checkout-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Checkout');
    modal.innerHTML = `
<div class="co" style="position:relative">
  <button class="x-btn co-x" id="broc-co-close-btn" aria-label="Close checkout">${CK_X}</button>

  <div id="broc-step-details" style="display:contents">
    <div class="co-main">
      <h2>Checkout</h2>
      <p class="sub">No account needed. We confirm stock and delivery with you after you place the order.</p>

      <fieldset>
        <legend>Your details</legend>
        <div class="opt-row">
          <div class="field"><label for="broc-co-name">Full name</label><input id="broc-co-name" type="text" autocomplete="name" required></div>
          <div class="field"><label for="broc-co-phone">Phone / WhatsApp</label><input id="broc-co-phone" type="tel" placeholder="+263 7X XXX XXXX" autocomplete="tel" required></div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Collection or delivery</legend>
        <div class="opt-row">
          <label class="opt"><input type="radio" name="co_delivery" value="collect" checked><span><b>Collect in Bulawayo</b><span>2142 Khami Rd, Iversens Complex</span></span></label>
          <label class="opt"><input type="radio" name="co_delivery" value="deliver"><span><b>Deliver to me</b><span>Cost confirmed before dispatch</span></span></label>
        </div>
        <div class="field" id="broc-addr-wrap" style="display:none"><label for="broc-co-address">Delivery address</label><input id="broc-co-address" type="text" autocomplete="street-address" placeholder="Street, suburb, city"></div>
      </fieldset>

      <fieldset>
        <legend>Payment</legend>
        <div id="broc-payment-options" style="display:grid;gap:10px">
          ${this._methods().map((m, i) => `<label class="opt"><input type="radio" name="broc_payment" value="${m.value}" ${i === 0 ? 'checked' : ''}><span><b>${m.label}</b><span>${m.desc}</span></span></label>`).join('')}
        </div>
        <div class="co-info" id="broc-paynow-notice">You will be taken to Paynow to complete payment securely.</div>
        <div id="broc-paypal-container" style="display:none;margin-top:14px"></div>
      </fieldset>

      <div class="field" style="margin-bottom:22px"><label for="broc-co-notes">Order notes <span style="font-weight:400;color:var(--faint)">(optional)</span></label><textarea id="broc-co-notes" style="min-height:90px" placeholder="Board sizes, edging, preferred delivery time…"></textarea></div>

      <div class="co-err" id="broc-co-error" role="alert"></div>
      <div class="co-actions">
        <button class="btn btn-primary btn-block" id="broc-place-btn" type="button">Place order</button>
      </div>
      <p style="font-size:12.5px;color:var(--faint);margin-top:14px;line-height:1.5">By placing your order you agree to our <a href="legal.html" style="color:inherit">terms of sale</a>. Prices are confirmed by us when the order is accepted.</p>
    </div>
    <aside class="co-side">
      <h3>Order summary</h3>
      <div id="broc-order-summary"></div>
    </aside>
  </div>

  <div id="broc-step-success" class="co-done" style="display:none">
    <div class="ok" id="broc-success-icon">${CK_CHECK}</div>
    <h2>Order received</h2>
    <p id="broc-success-msg"></p>
    <div class="row">
      <button class="btn btn-wa" id="broc-wa-confirm-btn" type="button">Confirm on WhatsApp</button>
      <button class="btn btn-line" id="broc-co-done-btn" type="button">Continue shopping</button>
    </div>
  </div>
</div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', e => { if (e.target === modal) this.close(); });
    modal.querySelector('#broc-co-close-btn').addEventListener('click', () => this.close());
    modal.querySelector('#broc-place-btn').addEventListener('click', () => this.placeOrder());
    modal.querySelector('#broc-wa-confirm-btn').addEventListener('click', () => this.sendWhatsApp());
    modal.querySelector('#broc-co-done-btn').addEventListener('click', () => this.close());
    modal.addEventListener('change', e => {
      if (e.target.name === 'broc_payment') this._onPaymentMethodChange(e.target.value);
      if (e.target.name === 'co_delivery') {
        modal.querySelector('#broc-addr-wrap').style.display = e.target.value === 'deliver' ? '' : 'none';
      }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
  },

  _onPaymentMethodChange(method) {
    const pp = document.getElementById('broc-paypal-container');
    const pn = document.getElementById('broc-paynow-notice');
    const btn = document.getElementById('broc-place-btn');
    if (pp) pp.style.display = method === 'PayPal' ? '' : 'none';
    if (pn) pn.style.display = method === 'Paynow' ? 'block' : 'none';
    if (btn) {
      btn.style.display = method === 'PayPal' ? 'none' : '';
      btn.textContent = method === 'Paynow' ? 'Pay with Paynow' : 'Place order';
    }
    if (method === 'PayPal' && SHOP.paypal.enabled) PayPalIntegration.loadButton();
  },

  open() {
    if (Cart.count === 0) { shopToast('Your cart is empty'); return; }
    this.mount();
    this.goStep(1);
    document.getElementById('broc-checkout-modal').style.display = 'block';
    document.body.style.overflow = 'hidden';
  },
  close() {
    const m = document.getElementById('broc-checkout-modal');
    if (m) m.style.display = 'none';
    document.body.style.overflow = '';
  },

  /* 1 and 2 show the form, 3 shows the confirmation */
  goStep(n) {
    const form = document.getElementById('broc-step-details');
    const done = document.getElementById('broc-step-success');
    if (form) form.style.display = n === 3 ? 'none' : 'contents';
    if (done) done.style.display = n === 3 ? '' : 'none';
    if (n !== 3) {
      this._populateSummary();
      const sel = document.querySelector('input[name="broc_payment"]:checked');
      if (sel) this._onPaymentMethodChange(sel.value);
    }
    document.getElementById('broc-checkout-modal')?.scrollTo({ top: 0 });
  },

  _populateSummary() {
    const el = document.getElementById('broc-order-summary');
    if (!el) return;
    el.innerHTML = Cart._items.map(i => `
      <div class="co-line"><span>${escSH(i.name)} <small>× ${i.qty}</small></span><span>${ckMoney(i.price * i.qty)}</span></div>`).join('') +
      `<div class="co-total"><span>Total</span><b>${ckMoney(Cart.total)}</b></div>
       <p style="font-size:12.5px;color:var(--muted);margin-top:12px;line-height:1.5">Delivery, if chosen, is quoted separately and confirmed with you first.</p>`;
  },

  async placeOrder() {
    const v = id => document.getElementById(id)?.value?.trim();
    const name = v('broc-co-name'), phone = v('broc-co-phone'), notesIn = v('broc-co-notes');
    const mode = document.querySelector('input[name="co_delivery"]:checked')?.value || 'collect';
    const address = mode === 'deliver' ? v('broc-co-address') : '';
    const payment = document.querySelector('input[name="broc_payment"]:checked')?.value || 'Cash on Delivery';
    const errEl = document.getElementById('broc-co-error');
    const btn = document.getElementById('broc-place-btn');
    const fail = html => { errEl.innerHTML = html; errEl.style.display = 'block'; };

    if (!name || !phone) return fail('Please enter your name and phone number.');
    if (mode === 'deliver' && !address) return fail('Please enter a delivery address, or choose collection.');
    errEl.style.display = 'none';

    const notes = [mode === 'deliver' ? 'DELIVERY requested' : 'COLLECTION from Bulawayo', notesIn].filter(Boolean).join(' | ');

    if (payment === 'Paynow' && SHOP.paynow.enabled) {
      await PaynowIntegration.initiatePayment({ name, phone, address, notes });
      return;
    }

    const label = btn.textContent;
    btn.textContent = 'Placing order…';
    btn.disabled = true;
    try {
      const saved = await placeOrderServer({ name, phone, address, notes, method: payment });
      this._lastOrder = {
        id: saved.id, items: saved.items, total: saved.total,
        customer_name: name, customer_phone: phone,
        customer_address: address || null, notes,
        payment_method: payment, status: 'pending',
      };
      document.getElementById('broc-success-msg').innerHTML =
        `Thank you, <strong>${escSH(name)}</strong>. Your order ${saved?.id ? '<strong>#' + saved.id + '</strong> ' : ''}for <strong>${ckMoney(saved.total)}</strong> is in. We will call or message <strong>${escSH(phone)}</strong> to confirm stock${mode === 'deliver' ? ' and delivery' : ' and a collection time'}.<br><br>Tap below to send the order to us on WhatsApp for the fastest confirmation.${saved?.id ? `<br><br><a href="track.html?order=${saved.id}" style="color:#d4520f;font-weight:600">Track this order</a>` : ''}`;
      Cart.clear();
      this.goStep(3);
    } catch (err) {
      console.error('[Armand] Order failed:', err);
      fail(`We could not place the order (${escSH(err.message || 'network error')}). <a href="https://wa.me/${SHOP.waNumber}" style="color:inherit;font-weight:600">Order on WhatsApp instead</a>`);
      btn.textContent = label;
      btn.disabled = false;
    }
  },

  sendWhatsApp() {
    const o = this._lastOrder;
    if (!o) return;
    const lines = (o.items || []).map(i => `• ${i.name} × ${i.qty} — ${SHOP.currency} ${(i.price * i.qty).toFixed(2)}`).join('\n');
    const msg =
`Hello Armand Carpentry & Designs, I have just placed an order on your website.

Order ${o.id ? '#' + o.id : ''}
${lines}

Total: ${SHOP.currency} ${Number(o.total || 0).toFixed(2)}
Payment: ${o.payment_method}
Name: ${o.customer_name}
Phone: ${o.customer_phone}${o.customer_address ? `\nAddress: ${o.customer_address}` : ''}
${o.notes ? 'Notes: ' + o.notes : ''}

Please confirm availability and next steps. Thank you.`;
    window.open(`https://wa.me/${SHOP.waNumber}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  },
};



/* ═════════════════════════════════════════════════════════════
   PHASE 5 — PAYNOW ZIMBABWE INTEGRATION
   ─────────────────────────────────────────────────────────────
   Paynow requires a server-side component (they use HMAC
   signature verification). This module calls your Netlify/Vercel
   serverless function (see paynow-init.js below).

   To activate:
   1. Deploy netlify/functions/paynow-init.js (included at bottom)
   2. Set SHOP.paynow.enabled = true
   3. Fill in your integrationId / integrationKey
   ─────────────────────────────────────────────────────────────
   MOCK mode (SHOP.paynow.enabled = false):
   Shows a simulated redirect so you can test the UI flow
   without a live Paynow account.
═════════════════════════════════════════════════════════════ */
const PaynowIntegration = {
  async initiatePayment({ name, phone, address, notes }) {
    const errEl   = document.getElementById('broc-co-error');
    const placeBtn= document.getElementById('broc-place-btn');

    placeBtn.textContent = '⏳ Connecting to Paynow...';
    placeBtn.disabled = true;
    errEl.style.display = 'none';

    // Save a pending order first so we have a reference
    let orderId;
    let orderTotal = 0;
    try {
      const saved = await placeOrderServer({ name, phone, address, notes, method: 'Paynow' });
      orderId = saved?.id;
      orderTotal = Number(saved.total);
      Checkout._lastOrder = {
        id: saved.id, items: saved.items, total: saved.total,
        customer_name: name, customer_phone: phone,
        customer_address: address || null, notes: notes || null,
        payment_method: 'Paynow', status: 'pending',
      };
    } catch (dbErr) {
      // Never send the customer to pay if the order could not be saved or stock check failed.
      console.warn('[Armand Paynow] Could not pre-save order:', dbErr);
      errEl.textContent = dbErr.message || 'Order could not be placed. Please try again.';
      errEl.style.display = 'block';
      placeBtn.textContent = 'Place Order';
      placeBtn.disabled = false;
      return;
    }

    if (!SHOP.paynow.enabled) {
      // ── MOCK mode ──────────────────────────────────────────
      shopToast('Paynow mock: redirecting...');
      setTimeout(() => {
        placeBtn.textContent = 'Pay via Paynow →';
        placeBtn.disabled = false;
        const mockMsg = document.getElementById('broc-success-msg');
        if (mockMsg) {
          const _pnIcon = document.getElementById('broc-success-icon');
          if (_pnIcon) { _pnIcon.style.borderColor='rgba(90,90,90,.4)'; _pnIcon.style.color='#5a5a5a'; _pnIcon.style.background='rgba(90,90,90,.1)'; }
          mockMsg.innerHTML =
            `<strong style="color:var(--silver,#e2e2e2);">Paynow mock flow complete!</strong><br>
             In production you'd be redirected to Paynow's payment page.<br>
             Order reference: <strong>#${orderId || 'PREVIEW'}</strong><br><br>
             Enable <code>SHOP.paynow.enabled = true</code> and deploy your serverless function to go live.`;
          Cart.clear();
          Checkout.goStep(3);
        }
      }, 2000);
      return;
    }

    // ── Live Paynow via serverless function ─────────────────
    try {
      const res = await fetch(SHOP.paynow.initEndpoint, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          orderId    : orderId || Date.now(),
          amount     : orderTotal,
          email      : `${phone.replace(/\D/g,'')}@paynow.co.zw`,   // Paynow requires email
          phone      : phone,
          description: `Armand Order — ${Cart._items.map(i => i.name).join(', ').slice(0,100)}`,
          returnUrl  : SHOP.paynow.returnUrl,
          resultUrl  : SHOP.paynow.resultUrl,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);

      if (payload.redirectUrl) {
        Cart.clear();
        window.location.href = payload.redirectUrl;
      } else {
        throw new Error('No redirect URL from Paynow');
      }
    } catch (err) {
      console.error('[Armand Paynow] Error:', err);
      errEl.innerHTML = `Paynow connection failed: ${escSH(err.message)}<br>
        <a href="https://wa.me/${SHOP.waNumber}" style="color:#9a9a9a;">Order via WhatsApp →</a>`;
      errEl.style.display = 'block';
      placeBtn.textContent = 'Pay via Paynow →';
      placeBtn.disabled = false;
    }
  },
};


/* ═════════════════════════════════════════════════════════════
   PHASE 6 — PAYPAL INTEGRATION
   ─────────────────────────────────────────────────────────────
   Loads PayPal's JS SDK on demand (only when user selects PayPal
   as payment method). Renders the smart payment button inside
   #broc-paypal-container.

   To activate:
   1. Get a PayPal client ID at https://developer.paypal.com
   2. Set SHOP.paypal.enabled = true
   3. Set SHOP.paypal.clientId to your client ID
   4. For sandbox testing use your sandbox client ID

   After payment capture:
   - Order is saved to Supabase with payment_status: 'paid'
   - Cart is cleared
   - User is moved to success step
═════════════════════════════════════════════════════════════ */
const PayPalIntegration = {
  _loaded: false,
  _rendered: false,

  loadButton() {
    if (this._rendered) return;

    const container = document.getElementById('broc-paypal-container');
    if (!container) return;
    container.innerHTML = '<div style="font-size:12px;color:rgba(226,226,226,0.68);padding:8px 0;">Loading PayPal...</div>';

    if (!SHOP.paypal.enabled) {
      // Mock mode
      container.innerHTML = `
        <div style="padding:16px;background:rgba(255,196,57,0.08);border:1px solid rgba(255,196,57,0.2);
                    font-size:12px;color:rgba(226,226,226,0.6);line-height:1.7;text-align:center;">
          <strong style="color:#ffd140;">PayPal Mock Mode</strong><br>
          Set <code>SHOP.paypal.enabled = true</code> and add your client ID to activate.<br><br>
          <button id="broc-paypal-mock-btn"
            style="padding:10px 20px;background:#0070ba;color:#fff;border:none;cursor:pointer;
                   font-family:'Saira',sans-serif;font-size:14px;font-weight:700;
                   letter-spacing:1px;text-transform:uppercase;width:100%;">
            Mock PayPal Payment
          </button>
        </div>`;
      document.getElementById('broc-paypal-mock-btn')?.addEventListener('click', () => {
        this._handleSuccess({ id: 'MOCK-' + Date.now(), status: 'COMPLETED' });
      });
      return;
    }

    if (this._loaded) {
      this._renderButton();
      return;
    }

    // Load PayPal SDK script
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${SHOP.paypal.clientId}&currency=${SHOP.paypal.currency}&intent=${SHOP.paypal.intent}`;
    script.onload = () => {
      this._loaded = true;
      this._renderButton();
    };
    script.onerror = () => {
      if (container) container.innerHTML = `<div style="font-size:12px;color:#c1392b;padding:8px 0;">
        PayPal failed to load. <a href="https://wa.me/${SHOP.waNumber}" style="color:#9a9a9a;">Order via WhatsApp</a>
      </div>`;
    };
    document.head.appendChild(script);
  },

  _renderButton() {
    const container = document.getElementById('broc-paypal-container');
    if (!container || !window.paypal) return;
    container.innerHTML = '';
    this._rendered = true;

    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' },

      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [{
            amount: {
              value: Cart.total.toFixed(2),
              currency_code: SHOP.paypal.currency,
            },
            description: `Armand Carpentry & Designs Order — ${Cart._items.length} item(s)`,
          }],
        });
      },

      onApprove: async (data, actions) => {
        const details = await actions.order.capture();
        this._handleSuccess(details);
      },

      onError: (err) => {
        console.error('[Armand PayPal] Error:', err);
        shopToast('PayPal payment failed. Please try another method.');
      },

      onCancel: () => {
        shopToast('PayPal payment cancelled.');
      },
    }).render('#broc-paypal-container');
  },

  async _handleSuccess(details) {
    const name    = document.getElementById('broc-co-name')?.value?.trim()    || 'PayPal Customer';
    const phone   = document.getElementById('broc-co-phone')?.value?.trim()   || '—';
    const address = document.getElementById('broc-co-address')?.value?.trim() || null;
    const notes   = document.getElementById('broc-co-notes')?.value?.trim()   || null;

    // NOTE: the order is recorded as pending/unpaid. Marking it paid must be done
    // by a server-side PayPal capture verification (to be added before PayPal goes live).
    try {
      const ppNote = (notes ? notes + ' | ' : '') + 'PayPal txn ' + String(details?.id || '').slice(0, 60);
      const saved = await placeOrderServer({ name, phone, address, notes: ppNote, method: 'PayPal' });
      const savedOrder = {
        id: saved.id, items: saved.items, total: saved.total,
        customer_name: name, customer_phone: phone,
        customer_address: address || null, notes: ppNote,
        payment_method: 'PayPal', status: 'pending',
      };
      Checkout._lastOrder = savedOrder;

      const orderId = savedOrder?.id ? `#${savedOrder.id}` : '';
      const si=document.getElementById('broc-success-icon'); if(si){si.innerHTML='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5a5a5a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';}
      document.getElementById('broc-success-msg').innerHTML =
        `<strong style="color:var(--silver,#e2e2e2);">PayPal payment received!</strong><br>
         Order ${orderId} recorded - we will confirm it shortly.<br>
         PayPal Transaction ID: <code style="font-size:11px;color:rgba(226,226,226,0.68);">${escSH(details.id)}</code><br><br>
         Tap <em>Confirm on WhatsApp</em> to receive your delivery update.`;

      Cart.clear();
      Checkout.goStep(3);

    } catch (err) {
      console.error('[Armand PayPal] DB save error:', err);
      shopToast('Payment received but order save failed. Please WhatsApp us!');
    }
  },
};


/* mountCheckoutButton — cart drawer checkout is handled by CartUI in app.js */
function mountCheckoutButton() { /* no-op — CartUI handles checkout button */ }


/* ─────────────────────────────────────────────────────────────
   UTILITY
───────────────────────────────────────────────────────────────*/
function escSH(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function shopToast(msg) {
  if (typeof showToast === 'function') { showToast(msg); return; }
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:88px;left:50%;transform:translateX(-50%);
    background:#1e1d1f;color:#e2e2e2;padding:10px 20px;font-size:12px;
    border:1px solid rgba(90,90,90,0.3);z-index:9999;pointer-events:none;
    transition:opacity .3s;white-space:nowrap;`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 350); }, 2500);
}

function injectStyles() {
  if (!document.getElementById('broc-checkout-css')) { const l = document.createElement('link'); l.id = 'broc-checkout-css'; l.rel = 'stylesheet'; l.href = 'checkout.css'; document.head.appendChild(l); }
  if (document.getElementById('broc-shop-css')) return;
  const style = document.createElement('style');
  style.id = 'broc-shop-css';
  style.textContent = `
    @keyframes brocPulse { 0%,100%{opacity:.6;} 50%{opacity:.25;} }
    #broc-checkout-modal input:focus,
    #broc-checkout-modal textarea:focus {
      border-color:#9a9a9a !important;
      outline:none;
    }
    #broc-payment-options label:hover  { border-color:#9a9a9a !important; }
    #broc-place-btn:hover:not(:disabled) { opacity:.88; }
    #broc-checkout-btn:hover { opacity:.88; }
    .broc-qty-btn:hover { background:rgba(90,90,90,0.3) !important; }
  `;
  document.head.appendChild(style);
}


/* ─────────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', () => {
  injectStyles();

  // Patch app.js placeholder Supabase credentials if needed
  patchAppJsSupabase();

  // Restore cart from localStorage — must happen before any UI sync
  Cart.load();

  // Fetch and render products (homepage: featured only; returns early on other pages)
  loadProducts();

  // Event delegation for dynamically rendered Add-to-Cart buttons
  initCartDelegation();

  // Expose globals so other scripts and inline handlers can access these
  window.Cart     = Cart;
  window.Checkout = Checkout;
  window.Products = Products;
  window.SHOP     = SHOP;

  // Handle ?payment=success return from Paynow
  if (window.location.search.includes('payment=success')) {
    shopToast('Payment successful! Check your WhatsApp for confirmation.');
    history.replaceState(null, '', window.location.pathname);
  }

  
});
