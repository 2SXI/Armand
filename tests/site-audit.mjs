// Site-wide final checks: links, assets, ids, meta, alt text, nav consistency, a11y basics.
import fs from 'fs'; import path from 'path'; import { JSDOM } from 'jsdom';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pages = fs.readdirSync(root).filter(f => f.endsWith('.html'));
let fail = 0, pass = 0; const bad = [];
const ok = (c, m) => { if (c) pass++; else { fail++; bad.push(m); } };
for (const p of pages) {
  const html = fs.readFileSync(path.join(root, p), 'utf8');
  const d = new JSDOM(html).window.document;
  const ids = new Set([...d.querySelectorAll('[id]')].map(e => e.id));
  const dup = [...d.querySelectorAll('[id]')].map(e => e.id).filter((x, i, a) => a.indexOf(x) !== i);
  ok(!dup.length, `${p}: duplicate ids ${dup}`);
  ok(d.title && d.title.length > 5, `${p}: missing <title>`);
  ok(d.querySelector('meta[name=description]'), `${p}: missing meta description`);
  ok(d.querySelector('meta[name=viewport]'), `${p}: missing viewport`);
  ok(d.documentElement.lang === 'en', `${p}: missing lang`);
  if(!['admin.html','product.html'].includes(p)) ok(d.querySelectorAll('h1').length === 1, `${p}: h1 count ${d.querySelectorAll('h1').length}`);
  d.querySelectorAll('img').forEach(i => ok(i.hasAttribute('alt'), `${p}: img without alt ${i.getAttribute('src')}`));
  d.querySelectorAll('label[for]').forEach(l => ok(ids.has(l.htmlFor), `${p}: label for missing #${l.htmlFor}`));
  d.querySelectorAll('a[target=_blank]').forEach(a => ok(/noopener/.test(a.rel), `${p}: _blank without noopener ${a.href}`));
  d.querySelectorAll('button:not([type])').forEach(b => { if (b.closest('form')) ok(false, `${p}: form button without type`); });
  d.querySelectorAll('[src],[href]').forEach(e => {
    const u = e.getAttribute('src') || e.getAttribute('href');
    if (!u || /^(https?:|mailto:|tel:|data:|javascript:|\/\/)/.test(u)) return;
    const [file, hash] = u.split('#'); const f = file.split('?')[0];
    if (f && !f.startsWith('#')) ok(fs.existsSync(path.join(root, f)), `${p}: missing file ${u}`);
    if (hash && !f) ok(ids.has(hash), `${p}: dead anchor #${hash}`);
    if (hash && f && f.endsWith('.html') && fs.existsSync(path.join(root, f))) {
      const t = new JSDOM(fs.readFileSync(path.join(root, f), 'utf8')).window.document;
      ok(!!t.getElementById(hash), `${p}: ${u} anchor not found in target`);
    }
  });
  const nav = [...d.querySelectorAll('#navMenu a')].map(a => a.getAttribute('href')).join(',');
  const act = [...d.querySelectorAll('#navMenu a.active')].map(a => a.getAttribute('href'));
  if (d.getElementById('navMenu') && !['404.html','admin.html'].includes(p)) {
    if(p!=='index.html') ok(act.length === 1, `${p}: nav active count ${act.length}`);
    if (act.length === 1 && p !== 'index.html') ok(act[0] === p || (p==='product.html'&&act[0]==='products.html'), `${p}: wrong active nav item (${act[0]})`);
  }
  ok(!/lorem|TODO|FIXME|xxx-xxx/i.test(html.replace(/\+263 xxx xxx xxx/,'')), `${p}: placeholder text found`);
}
for (const f of ['robots.txt','sitemap.xml','site.webmanifest']) ok(fs.existsSync(path.join(root,f)), `missing ${f}`);
const sm = fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
for (const p of pages.filter(x=>!['admin.html','404.html','account.html','product.html'].includes(x))) ok(sm.includes(p), `sitemap missing ${p}`);
console.log(bad.map(b=>'FAIL '+b).join('\n')); console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
