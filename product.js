'use strict';
(function(){
const {esc:escSH,money,ICON,CATS,norm:normaliseCat,catLabel,stockState,salePct,Wish,cardHTML,skeletons}=SX;
const Products={loadAll:SX.loadAll,getById:SX.byId,loadById:SX.loadById};
const phTile=cat=>SX.ph(cat);
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const id = new URLSearchParams(location.search).get('id');
  const root = $('pdp');
  const notFound = () => { root.innerHTML = '<div class="nf"><h1>Product not found</h1><p style="color:var(--muted);margin-bottom:24px">It may have been removed or sold out.</p><a class="btn btn-dark" href="products.html">Back to the shop</a></div>'; };
  if (!id) return notFound();
  let p;
  try { p = await Products.loadById(id); } catch (e) { console.error(e); }
  if (!p) return notFound();

  const imgs = SX.imagesOf(p);
  const cat = normaliseCat(p.category), stt = stockState(p), out = stt.cls === 'out', pct = salePct(p);
  document.title = p.name + ' | Armand Carpentry & Designs';
  document.querySelector('meta[name="description"]')?.setAttribute('content', (p.short_description || p.description || p.name).slice(0, 155));
  $('bcCat').textContent = catLabel(cat) || 'Category'; $('bcCat').href = 'products.html?cat=' + cat; $('bcName').textContent = p.name;
  const wa = 'https://wa.me/263780793585?text=' + encodeURIComponent('Hi Armand, enquiry about ' + p.name + (p.sku ? ' (' + p.sku + ')' : '') + ': ');
  const waBack = 'https://wa.me/263780793585?text=' + encodeURIComponent('Hi Armand, when will ' + p.name + (p.sku ? ' (' + p.sku + ')' : '') + ' be back in stock?');
  const specs = [['SKU', p.sku], ['Department', catLabel(cat)], ['Availability', stt.text || 'Ask us']].filter(r => r[1]);

  root.innerHTML = `
  <div class="pdp">
    <div class="galwrap">
      <div class="gal">${imgs.length ? `<img id="mainImg" src="${escSH(imgs[0])}" alt="${escSH(p.name)}">` : phTile(cat)}</div>
      ${imgs.length > 1 ? `<div class="thumbs" role="list">${imgs.map((u, i) => `<button type="button" class="thumb ${i === 0 ? 'on' : ''}" data-i="${i}" aria-label="Photo ${i + 1} of ${imgs.length}"><img src="${escSH(u)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
    </div>
    <div>
      <div class="pcat">${escSH(catLabel(cat))}</div>
      <h1>${escSH(p.name)}</h1>
      <div class="meta-row"><div class="price">${pct ? `<s style="display:inline;margin-right:12px">${money(p.old_price)}</s>` : ''}${money(p.price)}</div>
        ${pct ? `<span class="pb sale">Save ${pct}%</span>` : ''}${stt.text ? `<span class="stock ${stt.cls}">${stt.text}</span>` : ''}</div>
      ${p.short_description || p.description ? `<p class="lead">${escSH(p.short_description || p.description)}</p>` : ''}
      <div class="buyrow"><div class="qty"><button type="button" data-q="-1" aria-label="Less">−</button><input id="qty" value="1" inputmode="numeric" aria-label="Quantity"><button type="button" data-q="1" aria-label="More">+</button></div>
        <button class="btn btn-primary" id="addBtn" ${out ? 'disabled' : ''}>${out ? 'Out of stock' : 'Add to cart'}</button></div>
      <div class="mini-links" style="margin-top:14px"><button class="wish" style="position:static;width:auto;height:auto;background:none;box-shadow:none;gap:8px;display:inline-flex;font-size:14px;color:var(--muted)" data-act="wish" data-pid="${escSH(p.id)}">${ICON.heart}<span>Save for later</span></button><a target="_blank" rel="noopener" href="${out ? waBack : wa}">${out ? 'Ask when it is back in stock' : 'Ask us about this product'}</a><button type="button" class="linkbtn" id="shareBtn">Share</button></div>
      <div class="assure">
        <div>${ICON.box}<p><b>Collect in Bulawayo</b><span>2142 Khami Rd, Iversens Complex. Mon to Fri 08:00 to 17:00, Sat 08:00 to 13:00.</span></p></div>
        <div>${ICON.cart}<p><b>Delivery on request</b><span>Priced and confirmed with you before dispatch.</span></p></div>
        <div>${ICON.check}<p><b>Need it in bulk?</b><span>Trade accounts and larger quantities are quoted. <a href="trade.html">Trade pricing</a></span></p></div>
      </div>
    </div>
  </div>`;
  /* ───── detail sections (tabs) ───── */
  (function details() {
    const L = SX.lines, KV = SX.kv;
    const feats = L(p.features).map(l => { const [k, v] = KV(l); return `<li>${k ? `<b>${escSH(k)}:</b> ` : ''}${escSH(v)}</li>`; }).join('');
    const paras = String(p.description || '').split(/\n{2,}|\r?\n/).map(x => x.trim()).filter(Boolean).map(x => `<p>${escSH(x)}</p>`).join('');
    const baseSpecs = [['SKU', p.sku], ['Department', catLabel(cat)], ['Availability', stt.text || 'Ask us']].filter(r => r[1]);
    const custom = L(p.specs).map(l => KV(l)).filter(r => r[0]);
    const specRows = baseSpecs.concat(custom);
    const matchKeys = String(p.matching || '').split(/[\n,]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
    const guide = L(p.install_guide);
    const isLink = guide.length === 1 && /^https?:\/\//i.test(guide[0]);
    const waFit = 'https://wa.me/263780793585?text=' + encodeURIComponent('Hi Armand, I would like a quote for fitting/installation. Product: ' + p.name + (p.sku ? ' (' + p.sku + ')' : ''));

    const tabs = [['info', 'Product Info', 1], ['specs', 'Specifications', 1], ['matching', 'Matching Products', matchKeys.length], ['collect', 'Click & Collect', 1],
                  ['install', 'How To Install', guide.length], ['fitting', 'Installation Services', 1], ['relatedWrap', 'Similar Products', 1]].filter(t => t[2]);
    const sec = (id, title, body) => `<section class="dsec" id="${id}"><h2>${title}</h2>${body}</section>`;
    let h = `<nav class="dtabs" id="dtabs" aria-label="Product sections">${tabs.map(t => `<a href="#${t[0]}" data-t="${t[0]}">${t[1]}</a>`).join('')}</nav><div class="dbody">`;
    h += sec('info', 'About this product', (feats ? `<ul class="feat">${feats}</ul>` : '') + (paras || (feats ? '' : '<p class="muted">Ask us for full details and sizes.</p>')));
    h += sec('specs', 'Product specifications', `<div class="spec-grid">${specRows.map(r => `<div><span>${escSH(r[0])}</span><b>${escSH(r[1])}</b></div>`).join('')}</div>`);
    if (matchKeys.length) h += sec('matching', 'Matching products', '<div class="grid" id="matchGrid"></div>');
    h += sec('collect', 'Click &amp; collect', `<div class="cc"><ol><li><b>Order online</b><span>Add it to your cart, or send the product to us on WhatsApp.</span></li><li><b>We confirm stock</b><span>We contact you to confirm availability before you travel.</span></li><li><b>Collect in Bulawayo</b><span>2142 Khami Rd, Iversens Complex. Mon to Fri 08:00 to 17:00, Sat 08:00 to 13:00. Bring your order number.</span></li></ol></div>`);
    if (guide.length) h += sec('install', 'How to install', isLink
      ? `<p>Watch the installation video for this product.</p><a class="btn btn-dark" target="_blank" rel="noopener" href="${escSH(guide[0])}">Watch the video</a>`
      : `<ol class="steps">${guide.map(g => `<li>${escSH(g)}</li>`).join('')}</ol>`);
    h += sec('fitting', 'Installation services', `<p>We design and fit kitchens and wardrobes, and can fit hardware like this for you. Tell us what you need and we will quote.</p><div class="hero-cta"><a class="btn btn-primary" target="_blank" rel="noopener" href="${waFit}">Get a fitting quote</a><a class="btn btn-line" href="contact.html">Contact us</a></div>`);
    h += '</div>';
    const wrap = document.createElement('section'); wrap.className = 'pdetail'; wrap.innerHTML = h;
    root.appendChild(wrap);

    // highlight the section being read
    const links = [...wrap.querySelectorAll('.dtabs a')];
    const ids = tabs.map(t => t[0]);
    const onScroll = () => {
      let cur = ids[0];
      ids.forEach(id => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < 160) cur = id; });
      links.forEach(a => a.classList.toggle('on', a.dataset.t === cur));
    };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    wrap.querySelectorAll('.dtabs a').forEach(a => a.addEventListener('click', e => {
      const el = document.getElementById(a.dataset.t); if (!el) return; e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', '#' + a.dataset.t);
    }));
    window.__matchKeys = matchKeys;
  })();
  root.querySelectorAll('.thumb').forEach(b => b.onclick = () => {
    $('mainImg').src = imgs[+b.dataset.i];
    root.querySelectorAll('.thumb').forEach(x => x.classList.toggle('on', x === b));
  });
  $('shareBtn').onclick = async () => {
    const data = { title: p.name, text: p.name + ' at Armand Carpentry & Designs', url: location.href };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(location.href); SX.toast('Link copied'); } } catch {}
  };
  /* search engines: product data */
  try {
    const ld = { '@context':'https://schema.org', '@type':'Product', name:p.name, sku:p.sku || undefined, category:catLabel(cat),
      description:(p.short_description || p.description || p.name), image:imgs.length ? imgs : undefined,
      brand:{ '@type':'Brand', name:'Armand Carpentry & Designs' },
      offers:{ '@type':'Offer', priceCurrency:'USD', price:Number(p.price || 0).toFixed(2), url:location.href,
        availability: out ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', seller:{ '@type':'Organization', name:'Armand Carpentry & Designs' } } };
    const el = document.createElement('script'); el.type = 'application/ld+json'; el.textContent = JSON.stringify(ld); document.head.appendChild(el);
    const setM = (sel, v) => document.querySelector(sel)?.setAttribute('content', v);
    setM('meta[property="og:title"]', p.name + ' | Armand Carpentry & Designs'); setM('meta[property="og:url"]', location.href);
    if (imgs[0]) setM('meta[property="og:image"]', new URL(imgs[0], location.href).href);
  } catch {}
  const qty = $('qty');
  root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => qty.value = Math.max(1, (parseInt(qty.value) || 1) + +b.dataset.q));
  const add = e => { SX.addToCart(p.id, parseInt(qty.value) || 1, e); setTimeout(SX.openCart, 350); };
  $('addBtn').onclick = add;
  if (!out) {
    const sb = $('stickyBuy'); sb.hidden = false; document.body.classList.add('has-sticky');
    sb.innerHTML = `<div class="price">${money(p.price)}</div><button class="btn btn-primary" id="stickyAdd">Add to cart</button>`;
    $('stickyAdd').onclick = add;
  }
  const seen = SX.recent.get().filter(x => x !== String(p.id));
  SX.recent.add(p.id);
  try {
    const all = await Products.loadAll();
    const rv = seen.map(id => all.find(x => String(x.id) === id)).filter(Boolean).slice(0, 4);
    if (rv.length && $('recentWrap')) { $('recent').innerHTML = rv.map(cardHTML).join(''); $('recentWrap').hidden = false; }
    const rel = all.filter(x => String(x.id) !== String(p.id) && normaliseCat(x.category) === cat).slice(0, 4);
    if (rel.length) { $('related').innerHTML = rel.map(cardHTML).join(''); $('relMore').href = 'products.html?cat=' + cat; $('relatedWrap').hidden = false; }
    else document.querySelector('.dtabs a[data-t="relatedWrap"]')?.remove();
    const mk = window.__matchKeys || [];
    if (mk.length && $('matchGrid')) {
      const hits = mk.map(k => all.find(x => String(x.sku || '').toLowerCase() === k || String(x.id) === k)).filter(x => x && String(x.id) !== String(p.id)).slice(0, 4);
      if (hits.length) $('matchGrid').innerHTML = hits.map(cardHTML).join('');
      else { $('matching')?.remove(); document.querySelector('.dtabs a[data-t="matching"]')?.remove(); }
    }
  } catch (e) {}
});

})();
