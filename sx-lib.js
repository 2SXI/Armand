/* Armand shop upgrade: shared catalogue helpers (works with the existing cart in armand-shop.js) */
(function () {
  'use strict';
  const URL_ = 'https://nasbxjharopveynnwgrg.supabase.co';
  const KEY  = 'sb_publishable_io0oLODozq0xdUJiNT37tQ_u2PWURX0';
  const WA   = '263780793585';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const money = n => 'USD ' + Number(n || 0).toFixed(2);
  const ICON = {
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M12 5v14M5 12h14"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    x:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.8 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.3 3.3 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z"/></svg>',
    cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2.2l2.1 10.2a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.2L20 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>',
    box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
  };

  const CATS = [
    { key:'boards',       label:'Boards & Panels' },
    { key:'edging',       label:'Edging' },
    { key:'hinges',       label:'Hinges & Pivot Systems' },
    { key:'handles',      label:'Handles & Knobs' },
    { key:'drawers',      label:'Drawer Systems' },
    { key:'locks',        label:'Locks & Security' },
    { key:'kitchen',      label:'Kitchen Fittings' },
    { key:'lighting',     label:'Lighting Hardware' },
    { key:'construction', label:'Construction Hardware' },
    { key:'closet',       label:'Closet Systems' },
    { key:'tools',        label:'Tools & Fixings' },
  ];
  const MAP = { board:'boards', boards:'boards', panels:'boards', melamine:'boards', edge:'edging', edging:'edging',
    knobs:'handles', security:'locks', fixings:'tools' };
  const norm = (raw = '') => { const k = String(raw).toLowerCase().trim().replace(/\s+/g, '_'); return MAP[k] || k; };
  const pretty = k => String(k || '').replace(/[_-]+/g, ' ').trim().replace(/\s+/g, ' ').replace(/\b([a-z])/g, m => m.toUpperCase());
  const catLabel = k => (CATS.find(c => c.key === k) || {}).label || pretty(k);


  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const CAT_BASE = {
    all:svg('<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>'),
    boards:svg('<rect x="3" y="7" width="18" height="10"/><path d="M3 11h18"/>'),
    edging:svg('<path d="M4 18h16M4 14h16M4 10h10"/>'),
    hinges:svg('<rect x="3" y="5" width="7" height="14"/><rect x="14" y="5" width="7" height="14"/><path d="M10 12h4"/>'),
    handles:svg('<rect x="4" y="10" width="16" height="4" rx="2"/><path d="M7 10V7M17 10V7"/>'),
    drawers:svg('<rect x="4" y="5" width="16" height="14"/><path d="M4 12h16M10 8.5h4M10 15.5h4"/>'),
    locks:svg('<rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    kitchen:svg('<path d="M4 10h16l-1.5 9h-13z"/><path d="M8 10l3-5M16 10l-3-5"/>'),
    closet:svg('<rect x="4" y="3" width="16" height="18"/><path d="M12 3v18M9 12v2M15 12v2"/>'),
    lighting:svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
    construction:svg('<path d="M3 20h18M5 20V9l7-5 7 5v11"/>'),
    tools:svg('<path d="M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-3-1-1-3z"/>'),
    box:svg('<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>'),
    general:svg('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12.5 9 5 9-5M3 17l9 5 9-5"/>'),
    fasteners:svg('<path d="M8 3h8l1.5 3L16 9H8L6.5 6z"/><path d="M12 9v12M9.5 12h5M9.5 15h5M9.5 18h5"/>'),
    brackets:svg('<path d="M5 4v16h15v-4H9V4z"/><circle cx="7" cy="8" r=".9"/><circle cx="16.5" cy="18" r=".9"/>'),
    adhesives:svg('<path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>'),
    sinks:svg('<path d="M3 12h18v1.5A5.5 5.5 0 0 1 15.5 19h-7A5.5 5.5 0 0 1 3 13.5z"/><path d="M9 12V6.5a2.5 2.5 0 0 1 5 0V8"/>'),
    storage:svg('<path d="M3 8h18l-1.6 11H4.6z"/><path d="M8 8l2-4h4l2 4M9 12v4M12 12v4M15 12v4"/>'),
    paint:svg('<rect x="4" y="3" width="13" height="5" rx="1"/><path d="M17 5.5h3v5h-8v3"/><rect x="10.5" y="13.5" width="3" height="7" rx="1"/>'),
    wheels:svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 4v5.5M12 14.5V20M4 12h5.5M14.5 12H20"/>'),
    glass:svg('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="m9 15 6-6M9 11l2-2"/>'),
    abrasives:svg('<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M6.5 12h.01M10 12h.01M13.5 12h.01M17 12h.01"/>'),
    worktops:svg('<path d="M3 10h18v4H3z"/><path d="M5 14v5M19 14v5M3 10l2-4h14l2 4"/>'),
    electrical:svg('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>'),
    safety:svg('<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>'),
    doors:svg('<rect x="6" y="3" width="12" height="18" rx="1"/><circle cx="15" cy="12" r=".9"/>'),
    furniture:svg('<path d="M4 9h16M6 9v10M18 9v10M4 9l1-3h14l1 3"/>'),
  };
  const ICON_RULES = [['general',/gener|misc|other/],['fasteners',/fasten|screw|bolt|nail|rivet|anchor/],['brackets',/bracket|support|angle/],['adhesives',/adhes|glue|sealant|silicon|bond|epoxy/],['sinks',/sink|basin|tap|plumb|bath|sanit/],['storage',/storage|organi|basket|rack|holder|shelf|shelv/],['paint',/paint|finish|varnish|stain|lacquer|brush|roller/],['wheels',/wheel|castor|caster/],['glass',/glass|mirror/],['abrasives',/abras|sand|grind|polish/],['worktops',/granite|worktop|countertop|stone|slab/],['electrical',/electr|plug|socket|switch|cable/],['safety',/safety|ppe|protect/],['doors',/door|gate/],['furniture',/furnit|table|leg|feet|chair/],['hinges',/hinge|pivot/],['handles',/handle|knob|pull/],['drawers',/drawer|slide|runner/],['locks',/lock|secur|latch/],['lighting',/light|lamp|led/],['boards',/board|panel|melamine|wood|ply/],['edging',/edg|trim/],['kitchen',/kitchen/],['closet',/closet|wardrobe/],['construction',/construct|build|cement/],['tools',/tool|fixing/]];
  /* any department, even a new one, gets the closest matching icon instead of a generic cube */
  const CAT_ICON = new Proxy(CAT_BASE, { get(o, k) {
    if (typeof k !== 'string' || k in o) return o[k];
    const r = ICON_RULES.find(x => x[1].test(k.toLowerCase()));
    return r ? o[r[0]] : o.box;
  } });
  const GROUPS = [
    ['Boards & materials', ['boards', 'edging']],
    ['Hardware', ['hinges', 'handles', 'drawers', 'locks']],
    ['Fittings & tools', ['kitchen', 'closet', 'lighting', 'construction', 'tools']],
  ];

  const stockState = p => {
    const s = p.stock;
    if (s === null || s === undefined) return { cls:'', text:'' };
    if (s <= 0)  return { cls:'out', text:'Out of stock' };
    if (s <= 10) return { cls:'low', text:'Low stock' };
    return { cls:'', text:'In stock' };
  };
  const salePct = p => { const o = parseFloat(p.old_price), n = parseFloat(p.price); return (o > n && n > 0) ? Math.round((1 - n / o) * 100) : 0; };

  const Wish = {
    k:'armand_wish', ids:new Set(),
    load() { try { this.ids = new Set(JSON.parse(localStorage.getItem(this.k) || '[]').map(String)); } catch { this.ids = new Set(); } },
    has(id) { return this.ids.has(String(id)); },
    toggle(id) { id = String(id); this.ids.has(id) ? this.ids.delete(id) : this.ids.add(id);
      try { localStorage.setItem(this.k, JSON.stringify([...this.ids])); } catch {} try { document.dispatchEvent(new CustomEvent('wish:change', { detail: { id, on: this.ids.has(id) } })); } catch {} return this.ids.has(id); },
  };
  Wish.load();

  const ph = cat => `<div class="ph" aria-hidden="true"><span class="ph-ico">${CAT_ICON[cat] || ICON.box}</span><span class="ph-lbl">${esc(catLabel(cat))}</span></div>`;

  function cardHTML(p) {
    const cat = norm(p.category), st = stockState(p), out = st.cls === 'out', pct = salePct(p);
    const href = 'product.html?id=' + encodeURIComponent(p.id);
    const img = p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : ph(cat);
    const badges = [
      pct ? `<span class="pb sale">-${pct}%</span>` : '',
      p.badge && !pct ? `<span class="pb ${/new/i.test(p.badge) ? 'new' : ''}">${esc(p.badge)}</span>` : '',
      st.cls === 'low' ? '<span class="pb low">Low stock</span>' : '',
      out ? '<span class="pb out">Out of stock</span>' : '',
    ].join('');
    return `
<article class="pcard" data-pid="${esc(p.id)}">
  <div class="pmedia">
    <a class="pimg" href="${href}" tabindex="-1" aria-label="${esc(p.name)}">${img}</a>
    <div class="pbadges">${badges}</div>
    <button class="wish ${Wish.has(p.id) ? 'on' : ''}" data-act="wish" data-pid="${esc(p.id)}" aria-label="Save ${esc(p.name)}" aria-pressed="${Wish.has(p.id)}">${ICON.heart}</button>
    <button class="qv-btn" data-act="qv" data-pid="${esc(p.id)}">Quick view</button>
  </div>
  <div class="pbody">
    <div class="pcat">${esc(catLabel(cat) || p.category || '')}</div>
    <a class="pname" href="${href}">${esc(p.name)}</a>
    <div class="pdesc">${esc(p.short_description || p.description || '')}</div>
    <div class="pfoot">
      <div><div class="price">${pct ? `<s>${money(p.old_price)}</s>` : ''}${money(p.price)}</div>${st.text ? `<div class="stock ${st.cls}">${st.text}</div>` : ''}</div>
      <button class="add" data-act="add" data-pid="${esc(p.id)}" ${out ? 'disabled' : ''} aria-label="Add ${esc(p.name)} to cart">${out ? 'Unavailable' : '<span>Add</span>' + ICON.plus}</button>
    </div>
    ${p.sku ? `<div class="sku">SKU ${esc(p.sku)}</div>` : ''}
  </div>
</article>`;
  }
  const skeletons = n => Array.from({ length:n }, () => '<div class="pcard skel"><div class="pmedia"><div class="pimg"></div></div><div class="pbody"><i style="width:40%"></i><i style="width:85%;height:16px"></i><i style="width:60%"></i></div></div>').join('');

  /* images: supports an optional `images` column (array or JSON text), falls back to `image` */
  function imagesOf(p) {
    let list = p.images;
    if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = list.split(/[\n,]+/).map(x => x.trim()); } }
    list = Array.isArray(list) ? list.filter(Boolean) : [];
    if (p.image && !list.includes(p.image)) list.unshift(p.image);
    return list;
  }
  /* text helpers for the product detail fields */
  const lines = t => String(t || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const kv = l => { const m = l.match(/^([^:|]{1,60}?)\s*[:|]\s*(.+)$/); return m ? [m[1].trim(), m[2].trim()] : [null, l]; };
  /* recently viewed (this device) */
  const recent = {
    k:'armand_recent',
    get() { try { return JSON.parse(localStorage.getItem(this.k) || '[]').map(String); } catch { return []; } },
    add(id) { id = String(id); const l = [id, ...this.get().filter(x => x !== id)].slice(0, 12); try { localStorage.setItem(this.k, JSON.stringify(l)); } catch {} },
  };

  /* data */
  const cache = [];
  const byId = id => cache.find(p => String(p.id) === String(id));
  function remember(rows) {
    rows.forEach(p => {
      if (!byId(p.id)) cache.push(p);
      try { if (typeof Products !== 'undefined' && Products.cache && !Products.getById(p.id)) Products.cache.push(p); } catch {}
    });
  }
  async function rest(path) {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers:{ apikey:KEY, Authorization:'Bearer ' + KEY } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  async function loadAll() {
    const page = async filter => { let all = [], off = 0;
      while (true) { const rows = await rest(`products?select=*${filter}&order=name.asc&limit=1000&offset=${off}`); all = all.concat(rows); if (rows.length < 1000) break; off += 1000; }
      return all; };
    let rows; try { rows = await page('&active=eq.true'); } catch { rows = await page(''); }
    remember(rows); return rows;
  }
  async function loadById(id) {
    const hit = byId(id); if (hit) return hit;
    const r = await rest('products?select=*&id=eq.' + encodeURIComponent(id)); if (r[0]) remember([r[0]]); return r[0];
  }

  /* actions */
  const toast = m => { try { (window.showToast || (() => {}))(m); } catch {} };
  function addToCart(id, qty, ev) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    for (let i = 0; i < qty; i++) Cart.add(String(id), i === 0 ? ev : undefined);
  }
  function openCart() { try { CartUI.open(); } catch {} }

  document.addEventListener('click', e => {
    const b = e.target.closest('.sx [data-act]'); if (!b) return;
    const pid = b.dataset.pid;
    if (b.dataset.act === 'add' && !b.disabled) addToCart(pid, 1, e);
    else if (b.dataset.act === 'wish') {
      e.preventDefault();
      const on = Wish.toggle(pid);
      document.querySelectorAll(`.wish[data-pid="${CSS.escape(pid)}"]`).forEach(el => { el.classList.toggle('on', on); el.setAttribute('aria-pressed', on); });
      toast(on ? 'Saved to your list' : 'Removed from your list');
      window.dispatchEvent(new CustomEvent('wishchange'));
    } else if (b.dataset.act === 'qv' && window.SX.openQuickView) window.SX.openQuickView(pid);
  });

  window.SX = { lines, kv, CAT_ICON, GROUPS, imagesOf, recent, esc, money, ICON, CATS, norm, catLabel, stockState, salePct, Wish, ph, cardHTML, skeletons, byId, loadAll, loadById, addToCart, openCart, toast, WA };
})();
