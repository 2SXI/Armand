import sys, json, re
from playwright.sync_api import sync_playwright
pages=['index','products','product','about','contact','trade','portfolio','track','account','legal','404']
BASE='http://localhost:8765/'
issues=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in (1280,390):
        for pg in pages:
            ctx=b.new_context(viewport={'width':w,'height':800}); page=ctx.new_page()
            errs=[]
            page.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)[:140]))
            page.on('console',lambda m:errs.append('CONSOLE '+m.text[:140]) if m.type=='error' else None)
            page.on('requestfailed',lambda r:errs.append('REQFAIL '+r.url[:90]) if 'localhost' in r.url else None)
            page.on('response',lambda r:errs.append('HTTP%d %s'%(r.status,r.url[:90])) if r.status>=400 and 'localhost' in r.url else None)
            url=BASE+pg+'.html'+('?id=1' if pg=='product' else '')
            try: page.goto(url,wait_until='load',timeout=15000); page.wait_for_timeout(900)
            except Exception as e: errs.append('GOTO '+str(e)[:80])
            ov=page.evaluate("()=>{const d=document.documentElement;return d.scrollWidth-d.clientWidth}")
            bad=page.evaluate("()=>[...document.images].filter(i=>i.complete&&i.naturalWidth===0&&i.src).map(i=>i.src.slice(-60))")
            if ov>2: errs.append('OVERFLOW-X %dpx'%ov)
            for s in bad[:3]: errs.append('BROKEN-IMG '+s)
            errs=[e for e in errs if 'supabase' not in e.lower() and 'jsdelivr' not in e.lower() and 'ERR_' not in e.split(' ')[-1]]
            for e in dict.fromkeys(errs): issues.append((w,pg,e))
            ctx.close()
    b.close()
for i in issues: print(*i)
print('done',len(issues))
