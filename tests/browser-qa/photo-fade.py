import json
exec(open('/tmp/shopqa.py').read().split("log=[]")[0])
P=[{'id':'201','name':'White cutout product','sku':'A1','price':10,'stock':9,'category':'sinks','image':'testimg/white.jpg','active':True,'featured':True},
   {'id':'202','name':'Wood board texture','sku':'A2','price':20,'stock':9,'category':'boards','image':'testimg/wood.jpg','active':True,'featured':True}]
def h3(route):
    u=route.request.url
    if '/testimg/' in u: route.fulfill(status=200,content_type='image/jpeg',body=open('/tmp'+u[u.index('/testimg/'):],'rb').read())
    elif '/rest/v1/products' in u:
        from urllib.parse import urlparse,parse_qs
        q=parse_qs(urlparse(u).query); body=[x for x in P if x['id']==q['id'][0].replace('eq.','')] if 'id' in q else (P if q.get('offset',['0'])[0]=='0' else [])
        route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
    else: route.continue_()
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1100,'height':700}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:150])); ctx.route('**/*',h3)
    pg.goto('http://localhost:8765/products.html'); pg.wait_for_timeout(2000)
    r=pg.evaluate("[...document.querySelectorAll('.pcard')].map(c=>c.querySelector('.pname').textContent+' -> fade: '+c.querySelector('.pimg img').classList.contains('lightbg'))")
    print('listing:',r)
    pg.screenshot(path='/tmp/lightbg_list.png',clip={'x':330,'y':430,'width':770,'height':270})
    for pid,name in (('202','wood'),('201','white')):
        pg.goto('http://localhost:8765/product.html?id=%s'%pid); pg.wait_for_timeout(1800)
        print('product page',name,'-> fade:',pg.evaluate("document.querySelector('.galwrap .gal img').classList.contains('lightbg')"))
        pg.locator('.galwrap .gal').first.screenshot(path='/tmp/lightbg_%s.png'%name)
    print('errors:',errs); b.close()
