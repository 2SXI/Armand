import json, re
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
cats=['edging','handles','hinges','sinks','fasteners','brackets','adhesives','storage','tools','general']
imgs=['img/hero-handles.webp','img/hero-locks.webp','img/hero-hinges.webp','img/hero-drawers.webp',None]
P=[{'id':str(100+i),'name':'%s item %02d'%(cats[i%10].title(),i),'sku':'SKU-%03d'%i,'price':round(2+i*3.7,2),'stock':0 if i%7==0 else (3 if i%5==0 else 40),'category':cats[i%10],'description':'Sample description %d'%i,'image':imgs[i%5],'active':True,'featured':i<8} for i in range(30)]
def handler(route):
    u=route.request.url
    if '/rest/v1/products' in u:
        q=parse_qs(urlparse(u).query)
        if 'id' in q: pid=q['id'][0].replace('eq.',''); body=[p for p in P if p['id']==pid]
        else: body=P if q.get('offset',['0'])[0]=='0' else []
        route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
    elif 'supabase.co' in u: route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body='[]')
    else: route.continue_()
log=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h in ((1280,800),(390,800)):
        ctx=b.new_context(viewport={'width':w,'height':h}); pg=ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)[:160]))
        pg.on('console',lambda m:errs.append('CONSOLE '+m.text[:160]) if m.type=='error' and 'supabase' not in m.text.lower() else None)
        ctx.route('**/*',handler)
        pg.goto('http://localhost:8765/products.html'); pg.wait_for_timeout(1500)
        n=pg.locator('.pcard').count(); log.append((w,'products cards',n))
        pg.screenshot(path='/tmp/qa_products_%d.png'%w)
        try:
            pg.locator('.pcard .add').first.click(timeout=2000); pg.wait_for_timeout(500)
            log.append((w,'cart count after add',pg.inner_text('#cartCount')))
        except Exception as e: errs.append('ADD FAIL '+str(e)[:100])
        try:
            pg.locator('.pcard a').first.click(timeout=2000); pg.wait_for_timeout(1200)
            log.append((w,'product page title',pg.locator('h1').first.inner_text()[:40]))
            pg.screenshot(path='/tmp/qa_product_%d.png'%w)
            ov=pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth"); log.append((w,'product overflow',ov))
        except Exception as e: errs.append('PRODUCT NAV FAIL '+str(e)[:100])
        pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(1500)
        log.append((w,'home featured cards',pg.locator('.pcard').count()))
        pg.evaluate("window.scrollTo(0,document.querySelector('#faq').offsetTop-100)"); pg.wait_for_timeout(400)
        pg.screenshot(path='/tmp/qa_home_faq_%d.png'%w)
        for e in dict.fromkeys(errs): log.append((w,'ERR',e))
        ctx.close()
    b.close()
for l in log: print(*l)
