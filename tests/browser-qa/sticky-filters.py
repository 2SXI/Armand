exec(open('/tmp/shopqa.py').read().split("log=[]")[0])
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h in ((1440,800),(1100,700),(1440,520)):
        ctx=b.new_context(viewport={'width':w,'height':h}); pg=ctx.new_page(); ctx.route('**/*',handler)
        pg.goto('http://localhost:8765/products.html'); pg.wait_for_timeout(1500)
        tops=[]
        for y in (0,600,1500,2600):
            pg.evaluate("window.scrollTo(0,%d)"%y); pg.wait_for_timeout(150)
            r=pg.evaluate("(()=>{const f=document.querySelector('.filters').getBoundingClientRect();return [Math.round(f.top),Math.round(f.bottom),innerHeight]})()")
            tops.append((y,r[0],r[1]))
        print(w,'x',h,'(scrollY, top, bottom):',tops,'| stays inside window:',all(t[2]<=h+1 for t in tops))
        ctx.close()
    ctx=b.new_context(viewport={'width':390,'height':800}); pg=ctx.new_page(); ctx.route('**/*',handler)
    pg.goto('http://localhost:8765/products.html'); pg.wait_for_timeout(1500)
    print('mobile: filters position =',pg.evaluate("getComputedStyle(document.querySelector('.filters')).position"),'| hidden until opened:',pg.evaluate("getComputedStyle(document.querySelector('.filters')).visibility"))
    b.close()
