'use strict';
(function () {
const {esc:escSH,money,ICON,CATS,norm:normaliseCat,catLabel,stockState,salePct,Wish,cardHTML,skeletons}=SX;
const Products={loadAll:SX.loadAll,getById:SX.byId,loadById:SX.loadById};
const phTile=cat=>SX.ph(cat);

  const PAGE = 24;
  const $ = id => document.getElementById(id);
  let all = [], shown = PAGE, view = 'grid';
  const st = { cat:'', q:'', sort:'featured', min:'', max:'', stock:false, sale:false, wish:false };

  const q = new URLSearchParams(location.search);
  st.cat = normaliseCat(q.get('cat') || ''); st.q = q.get('q') || ''; st.sort = q.get('sort') || 'featured';
  st.min = q.get('min') || ''; st.max = q.get('max') || ''; st.stock = q.get('stock') === '1'; st.sale = q.get('sale') === '1';

  function sync() {
    const p = new URLSearchParams();
    if (st.cat) p.set('cat', st.cat); if (st.q) p.set('q', st.q);
    if (st.sort !== 'featured') p.set('sort', st.sort);
    if (st.min) p.set('min', st.min); if (st.max) p.set('max', st.max);
    if (st.stock) p.set('stock', '1'); if (st.sale) p.set('sale', '1');
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
  }
  function filtered(ignoreCat) {
    const terms = st.q.toLowerCase().split(/\s+/).filter(Boolean);
    const min = parseFloat(st.min), max = parseFloat(st.max);
    return all.filter(p => {
      if (!ignoreCat && st.cat && normaliseCat(p.category) !== st.cat) return false;
      const price = parseFloat(p.price || 0);
      if (!isNaN(min) && price < min) return false;
      if (!isNaN(max) && price > max) return false;
      if (st.stock && !(p.stock === null || p.stock === undefined || p.stock > 0)) return false;
      if (st.sale && !salePct(p)) return false;
      if (st.wish && !Wish.has(p.id)) return false;
      if (terms.length) {
        const hay = [p.name, p.sku, p.description, p.short_description, p.category, p.badge].join(' ').toLowerCase();
        if (!terms.every(t => hay.includes(t))) return false;
      }
      return true;
    });
  }
  function sorted(list) {
    const l = list.slice();
    if (st.sort === 'name') l.sort((a, b) => a.name.localeCompare(b.name));
    else if (st.sort === 'low') l.sort((a, b) => a.price - b.price);
    else if (st.sort === 'high') l.sort((a, b) => b.price - a.price);
    else if (st.sort === 'sale') l.sort((a, b) => salePct(b) - salePct(a));
    else l.sort((a, b) => (b.featured === true) - (a.featured === true) || (!!b.badge) - (!!a.badge));
    return l;
  }
  let deptOpen = false;
  const DEPT_LIMIT = 8;
  function renderNav() {
    const base = filtered(true), counts = {};
    base.forEach(p => { const c = normaliseCat(p.category); counts[c] = (counts[c] || 0) + 1; });
    const keys = Object.keys(counts).filter(k => k);
    const byCount = keys.slice().sort((x, y) => counts[y] - counts[x] || catLabel(x).localeCompare(catLabel(y)));
    $('catChips').innerHTML = `<button class="chip ${!st.cat ? 'on' : ''}" data-cat="">All <small>${base.length}</small></button>` +
      byCount.map(k => `<button class="chip ${st.cat === k ? 'on' : ''}" data-cat="${escSH(k)}">${escSH(catLabel(k))} <small>${counts[k]}</small></button>`).join('');
    const item = (k, n) => `<button class="fcat ${st.cat === k ? 'on' : ''}" data-cat="${escSH(k)}" ${n || st.cat === k ? '' : 'disabled'}><span class="ic">${SX.CAT_ICON[k] || SX.CAT_ICON.box}</span><span class="nm">${escSH(catLabel(k))}</span><small>${n}</small></button>`;
    let html = `<button class="fcat ${!st.cat ? 'on' : ''}" data-cat=""><span class="ic">${SX.CAT_ICON.all}</span><span class="nm">All products</span><small>${base.length}</small></button>`;
    const many = byCount.length > DEPT_LIMIT + 2;
    if (many && !deptOpen) {
      let top = byCount.slice(0, DEPT_LIMIT);
      if (st.cat && !top.includes(st.cat)) top = top.slice(0, DEPT_LIMIT - 1).concat(st.cat);
      html += top.map(k => item(k, counts[k] || 0)).join('');
      html += `<button type="button" class="fmore" data-dept="open">Show all ${byCount.length} departments</button>`;
    } else {
      const used = new Set();
      SX.GROUPS.forEach(([title, ks]) => {
        const rows = ks.filter(k => counts[k] || st.cat === k).map(k => { used.add(k); return item(k, counts[k] || 0); });
        if (rows.length) html += `<div class="fsub">${title}</div>` + rows.join('');
      });
      const other = byCount.filter(k => !used.has(k));
      if (other.length) html += `<div class="fsub">${used.size ? 'More departments' : 'Departments'}</div>` + other.map(k => item(k, counts[k])).join('');
      if (many) html += '<button type="button" class="fmore" data-dept="close">Show fewer</button>';
    }
    $('fCats').innerHTML = html;
  }
  function renderActive() {
    const chips = [];
    if (st.q) chips.push(['q', `“${st.q}”`]);
    if (st.cat) chips.push(['cat', catLabel(st.cat)]);
    if (st.min || st.max) chips.push(['price', `USD ${st.min || 0} – ${st.max || 'any'}`]);
    if (st.stock) chips.push(['stock', 'In stock']); if (st.sale) chips.push(['sale', 'On sale']); if (st.wish) chips.push(['wish', 'Saved']);
    $('active').innerHTML = chips.map(([k, t]) => `<span class="achip">${escSH(t)}<button data-clear="${k}" aria-label="Remove filter">&times;</button></span>`).join('') +
      (chips.length > 1 ? '<button class="achip clear" data-clear="all">Clear all</button>' : '');
    $('fPriceReset').hidden = !(st.min || st.max);
    const n = chips.length;
    $('fCount').textContent = n ? '(' + n + ')' : ''; $('fClearAll').hidden = !n;
    $('fOpen').textContent = n ? 'Filters (' + n + ')' : 'Filters';
  }
  function render(reset) {
    if (reset) shown = PAGE;
    const list = sorted(filtered()), total = list.length;
    const title = st.cat ? catLabel(st.cat) : 'Shop';
    $('shopTitle').textContent = title; $('crumbCat').textContent = title;
    document.title = (st.cat ? title + ' | ' : '') + 'Shop | Armand Carpentry & Designs';
    $('count').innerHTML = `<b>${total}</b> ${total === 1 ? 'product' : 'products'}`;
    $('fClose').textContent = total ? `Show ${total} ${total === 1 ? 'result' : 'results'}` : 'No results';
    $('wishN').textContent = Wish.ids.size;
    renderNav(); renderActive(); sync();
    const g = $('grid');
    if (!total) {
      g.innerHTML = `<div class="empty"><h3>No products match</h3><p>Try removing a filter, or tell us what you are looking for and we will check what we have.</p><div class="row"><button class="btn btn-dark" data-clear="all">Clear filters</button><a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/263780793585?text=${encodeURIComponent('Hi Armand, do you have: ' + st.q)}">Ask on WhatsApp</a></div></div>`;
      $('more').hidden = true; return;
    }
    g.innerHTML = list.slice(0, shown).map(cardHTML).join('');
    const more = total > shown; $('more').hidden = total <= PAGE;
    $('moreBtn').hidden = !more;
    $('moreTxt').textContent = `Showing ${Math.min(shown, total)} of ${total}`;
    $('prog').style.width = Math.min(100, shown / total * 100) + '%';
  }

  /* quick view */
  SX.openQuickView = id => {
    const p = Products.getById(id); if (!p) return;
    const stt = stockState(p), out = stt.cls === 'out', pct = salePct(p);
    $('qvBox').innerHTML = `
      <button class="x" aria-label="Close" id="qvX">${ICON.x}</button>
      <div class="gal">${SX.imagesOf(p)[0] ? `<img src="${escSH(SX.imagesOf(p)[0])}" alt="${escSH(p.name)}">` : phTile(normaliseCat(p.category))}</div>
      <div class="det">
        <div class="pcat">${escSH(catLabel(normaliseCat(p.category)))}</div>
        <h2>${escSH(p.name)}</h2>
        <div class="price">${pct ? `<s style="display:inline;margin-right:10px">${money(p.old_price)}</s>` : ''}${money(p.price)}</div>
        ${stt.text ? `<div class="stock ${stt.cls}">${stt.text}</div>` : ''}
        <p class="desc">${escSH(p.short_description || p.description || 'Ask us for specifications and sizes.')}</p>
        <div class="buyrow"><div class="qty"><button type="button" data-q="-1" aria-label="Less">−</button><input id="qvQty" value="1" inputmode="numeric" aria-label="Quantity"><button type="button" data-q="1" aria-label="More">+</button></div>
        <button class="btn btn-primary" id="qvAdd" ${out ? 'disabled' : ''}>${out ? 'Out of stock' : 'Add to cart'}</button></div>
        <div class="mini-links"><a href="product.html?id=${encodeURIComponent(p.id)}">View full details</a><a target="_blank" rel="noopener" href="https://wa.me/263780793585?text=${encodeURIComponent(out ? 'Hi Armand, when will ' + p.name + ' be back in stock?' : 'Hi Armand, enquiry about ' + p.name + (p.sku ? ' (' + p.sku + ')' : ''))}">${out ? 'Ask when it is back' : 'Ask on WhatsApp'}</a></div>
      </div>`;
    lastFocus = document.activeElement;
    $('qvModal').classList.add('open'); document.body.style.overflow = 'hidden';
    $('qvX').focus();
    const qty = $('qvQty');
    $('qvBox').querySelectorAll('[data-q]').forEach(b => b.onclick = () => qty.value = Math.max(1, (parseInt(qty.value) || 1) + +b.dataset.q));
    $('qvAdd').onclick = e => { SX.addToCart(p.id, parseInt(qty.value) || 1, e); closeQV(); setTimeout(SX.openCart, 250); };
    $('qvX').onclick = closeQV;
  };
  let lastFocus = null;
  function closeQV() { $('qvModal').classList.remove('open'); document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || !$('qvModal').classList.contains('open')) return;
    const f = [...$('qvBox').querySelectorAll('a[href],button:not([disabled]),input')].filter(x => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $('qvModal').addEventListener('click', e => { if (e.target.id === 'qvModal') closeQV(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeQV(); closeF(); } });

  /* filter drawer (mobile) */
  const openF = () => { $('filters').classList.add('open'); $('fApply').hidden = false; };
  const closeF = () => { $('filters').classList.remove('open'); $('fApply').hidden = true; };
  $('fOpen').onclick = openF; $('fClose').onclick = closeF; $('fCloseX').onclick = closeF;

  /* events */
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-cat]');
    if (c && (c.classList.contains('chip') || c.classList.contains('fcat'))) { st.cat = c.dataset.cat; render(true); }
    const x = e.target.closest('[data-clear]');
    if (x) {
      const k = x.dataset.clear;
      if (k === 'q' || k === 'all') { st.q = ''; $('shopQ').value = ''; }
      if (k === 'cat' || k === 'all') st.cat = '';
      if (k === 'price' || k === 'all') { st.min = st.max = ''; $('pMin').value = $('pMax').value = ''; syncRange(); }
      if (k === 'stock' || k === 'all') { st.stock = false; $('fStock').checked = false; }
      if (k === 'sale' || k === 'all') { st.sale = false; $('fSale').checked = false; }
      if (k === 'wish' || k === 'all') { st.wish = false; $('fWish').checked = false; }
      render(true);
    }
    const dp = e.target.closest('[data-dept]');
    if (dp) { deptOpen = dp.dataset.dept === 'open'; renderNav(); }
    const v = e.target.closest('[data-view]');
    if (v) { view = v.dataset.view; document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b === v)); $('grid').classList.toggle('list', view === 'list'); }
  });
  /* live suggestions */
  const sugg = document.createElement('div'); sugg.className = 'sugg'; sugg.hidden = true; $('shopQ').parentNode.appendChild(sugg);
  const hideSugg = () => { sugg.hidden = true; };
  function showSugg(v) {
    const t = v.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (t.length === 0 || v.trim().length < 2) return hideSugg();
    const hits = all.filter(p => { const h = [p.name, p.sku].join(' ').toLowerCase(); return t.every(x => h.includes(x)); }).slice(0, 6);
    if (!hits.length) return hideSugg();
    sugg.innerHTML = hits.map(p => `<a href="product.html?id=${encodeURIComponent(p.id)}"><span>${escSH(p.name)}<small>${escSH(catLabel(normaliseCat(p.category)))}${p.sku ? ' · ' + escSH(p.sku) : ''}</small></span><b>${money(p.price)}</b></a>`).join('');
    sugg.hidden = false;
  }
  document.addEventListener('click', e => { if (!e.target.closest('.shop-search')) hideSugg(); });
  $('shopQ').addEventListener('keydown', e => { if (e.key === 'Escape') hideSugg(); if (e.key === 'Enter') hideSugg(); });
  $('shopQ').addEventListener('input', e => showSugg(e.target.value));
  let tq; $('shopQ').addEventListener('input', e => { clearTimeout(tq); $('shopQClear').classList.toggle('show', !!e.target.value); tq = setTimeout(() => { st.q = e.target.value.trim(); render(true); }, 220); });
  $('shopQClear').onclick = () => { $('shopQ').value = ''; st.q = ''; $('shopQClear').classList.remove('show'); render(true); };
  $('sort').onchange = e => { st.sort = e.target.value; render(true); };
  $('fStock').onchange = e => { st.stock = e.target.checked; render(true); };
  $('fSale').onchange = e => { st.sale = e.target.checked; render(true); };
  $('fWish').onchange = e => { st.wish = e.target.checked; render(true); };
  let PMAX = 0;
  function initRange() {
    const ps = all.map(p => parseFloat(p.price) || 0).sort((x, y) => x - y);
    const p98 = ps.length ? ps[Math.min(ps.length - 1, Math.floor(ps.length * 0.98))] : 0;   // ignore a few extreme prices
    const step = p98 > 1000 ? 100 : p98 > 100 ? 10 : 5;
    PMAX = Math.max(10, Math.ceil(p98 / step) * step);
    ['rMin', 'rMax'].forEach(id => { $(id).min = 0; $(id).max = PMAX; $(id).step = PMAX > 200 ? 5 : 1; });
    syncRange();
  }
  function syncRange() {
    if (!PMAX) return;
    const lo = st.min === '' ? 0 : Math.min(+st.min, PMAX), hi = st.max === '' ? PMAX : Math.min(+st.max, PMAX);
    $('rMin').value = lo; $('rMax').value = hi;
    const a = lo / PMAX * 100, b = hi / PMAX * 100;
    $('rTrack').style.background = `linear-gradient(90deg,var(--line-2) ${a}%,var(--brand) ${a}%,var(--brand) ${b}%,var(--line-2) ${b}%)`;
    $('rLabel').textContent = (lo || hi < PMAX) ? `USD ${lo} to ${hi}${hi >= PMAX ? '+' : ''}` : '';
  }
  let tr; const later = () => { clearTimeout(tr); tr = setTimeout(() => render(true), 140); };
  $('rMin').addEventListener('input', () => {
    let lo = +$('rMin').value, hi = +$('rMax').value; if (lo > hi) { lo = hi; $('rMin').value = lo; }
    st.min = lo <= 0 ? '' : String(lo); $('pMin').value = st.min; syncRange(); later();
  });
  $('rMax').addEventListener('input', () => {
    let lo = +$('rMin').value, hi = +$('rMax').value; if (hi < lo) { hi = lo; $('rMax').value = hi; }
    st.max = hi >= PMAX ? '' : String(hi); $('pMax').value = st.max; syncRange(); later();
  });
  const price = () => { st.min = $('pMin').value; st.max = $('pMax').value; syncRange(); render(true); };
  $('pMin').onchange = price; $('pMax').onchange = price;
  $('fPriceReset').onclick = () => { $('pMin').value = $('pMax').value = ''; price(); };
  $('moreBtn').onclick = () => { shown += PAGE; render(); };
  window.addEventListener('wishchange', () => { $('wishN').textContent = Wish.ids.size; if (st.wish) render(); });

  [['Under 10', '', 10], ['10 to 50', 10, 50], ['50 to 150', 50, 150], ['150+', 150, '']].forEach(([l, a, b]) => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'USD ' + l;
    btn.onclick = () => { $('pMin').value = a; $('pMax').value = b; price(); };
    $('pQuick').appendChild(btn);
  });

  document.getElementById('searchToggle')?.addEventListener('click', () => { $('shopQ').focus(); $('shopQ').scrollIntoView({ behavior:'smooth', block:'center' }); });

  /* init */
  $('shopQ').value = st.q; $('shopQClear').classList.toggle('show', !!st.q);
  $('sort').value = st.sort; $('fStock').checked = st.stock; $('fSale').checked = st.sale;
  $('pMin').value = st.min; $('pMax').value = st.max;
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      all = await Products.loadAll(); initRange(); render(true);
      const seen = SX.recent.get().map(id => all.find(x => String(x.id) === id)).filter(Boolean).slice(0, 4);
      if (seen.length) {
        const sec = document.createElement('div'); sec.className = 'recent-s';
        sec.innerHTML = '<h3>Recently viewed</h3><div class="grid">' + seen.map(cardHTML).join('') + '</div>';
        $('more').parentNode.appendChild(sec);
      }
    }
    catch (err) {
      console.error('[Armand] shop load failed', err);
      $('count').textContent = '';
      $('grid').innerHTML = `<div class="empty"><h3>We couldn't load the catalogue</h3><p>Check your connection and try again, or message us and we will help you directly.</p><div class="row"><button class="btn btn-dark" onclick="location.reload()">Try again</button><a class="btn btn-wa" href="https://wa.me/263780793585">WhatsApp us</a></div></div>`;
    }
  });
})();
