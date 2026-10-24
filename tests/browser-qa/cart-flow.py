import json,re
exec(open('/tmp/shopqa.py').read().split("log=[]")[0])
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1280,'height':800}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:150]))
    ctx.route('**/*',handler)
    pg.goto('http://localhost:8765/products.html'); pg.wait_for_timeout(1500)
    card=pg.locator('.pcard').nth(1)
    print('card actions html:',re.sub(r'\s+',' ',card.locator('.pbody, .pfoot, .pc-foot').first.inner_html())[:400] if card.locator('.pbody, .pfoot, .pc-foot').count() else re.sub(r'\s+',' ',card.inner_html())[-500:])
    btns=pg.locator('.pcard button')
    print('buttons in cards:',btns.count(), [btns.nth(i).get_attribute('class') for i in range(min(4,btns.count()))])
    add=pg.locator('.pcard [data-act="add"]:not([disabled])')
    print('add buttons:',add.count())
    if add.count():
        add.first.click(); pg.wait_for_timeout(700); print('cart count:',pg.inner_text('#cartCount'))
        pg.click('.nav-cart'); pg.wait_for_timeout(600); print('drawer items:',pg.locator('#brocCartDrawer .bcd-item').count())
    print('errors:',errs)
    b.close()
