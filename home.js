/* Homepage: live product grid and real catalogue counts */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  document.addEventListener('DOMContentLoaded', async () => {
    const grid = $('#sxHomeGrid');
    if (grid) grid.innerHTML = SX.skeletons(4);
    try {
      const all = await SX.loadAll();
      let list = all.filter(p => p.featured === true);
      if (!list.length) list = all.filter(p => !!p.badge);
      if (!list.length) list = all;
      list = list.slice(0, 8);
      if (list.length > 4 && list.length < 8) list = list.slice(0, 4);
      if (grid) grid.innerHTML = list.length ? list.map(SX.cardHTML).join('') : '';
      if (grid && !list.length) throw new Error('empty');

      const counts = {};
      all.forEach(p => { const c = SX.norm(p.category); counts[c] = (counts[c] || 0) + 1; });
      document.querySelectorAll('.cat-btn').forEach(b => {
        const k = b.dataset.cat, el = b.querySelector('.cb-count'); if (!el) return;
        const n = k === 'all' ? all.length : (counts[k] || 0);
        el.textContent = n; b.classList.toggle('is-empty', n === 0);
      });
      const hs = $('.hs-num[data-count]');
      if (hs) hs.innerHTML = all.length + '<sup>+</sup>';
    } catch (e) {
      console.error('[Armand] home load failed', e);
      if (grid) grid.innerHTML = '<div class="empty"><h3>Catalogue unavailable</h3><p>Browse the full shop or message us and we will check stock for you.</p><div class="row"><a class="btn btn-dark" href="products.html">Browse the shop</a><a class="btn btn-wa" href="https://wa.me/' + SX.WA + '">WhatsApp us</a></div></div>';
      document.querySelectorAll('.cb-count').forEach(el => { if (/\d\+/.test(el.textContent)) el.textContent = ''; });
    }
  });
})();
