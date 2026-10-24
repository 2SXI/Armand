import json, random
from playwright.sync_api import sync_playwright
random.seed(4)
st=['pending','confirmed','shipped','delivered','cancelled','ready','collected']
pay=['EcoCash','Bank transfer / EFT','Cash on collection']
import datetime as dt
now=dt.datetime.utcnow()
prods=[{'id':100+i,'name':'Product %02d'%i,'sku':'SKU%03d'%i,'category':['edging','handles','hinges','sinks'][i%4],'price':round(3+i*2.5,2),'stock':0 if i%9==0 else (3 if i%6==0 else 50),'active':i%11!=0,'image':None if i%5==0 else 'img/hero-locks.webp'} for i in range(60)]
orders=[]
for i in range(70):
    it=[{'id':100+random.randrange(60),'name':'Product %02d'%random.randrange(60),'price':round(random.uniform(3,90),2),'qty':random.randint(1,4)} for _ in range(random.randint(1,3))]
    orders.append({'id':500+i,'created_at':(now-dt.timedelta(days=random.randint(0,60),hours=random.randint(0,23))).isoformat()+'Z','customer_name':random.choice(['Tendai M','Rudo C','Farai N','Chipo D','Tino K']),'customer_phone':'07%08d'%random.randint(0,9999999),'customer_address':'12 Main St','total':round(sum(x['price']*x['qty'] for x in it),2),'status':random.choice(st),'payment_method':random.choice(pay),'items':it,'notes':''})
orders.sort(key=lambda o:-o['id'])
enq=[{'id':i,'created_at':now.isoformat()+'Z','name':'Lead %d'%i,'phone':'0771','message':'Hello','email':'a@b.c'} for i in range(5)]
STUB='''(function(){const D=%s;function B(t){let rows=(D[t]||[]).slice(),cnt=null;const b={};
['select','eq','neq','gte','lte','gt','lt','in','is','ilike','like','or','not','order','limit','filter','match','textSearch'].forEach(m=>b[m]=function(){if(m==='limit')rows=rows.slice(0,arguments[0]);return b});
b.range=function(a,z){rows=rows.slice(a,z+1);return b};
['insert','update','upsert','delete'].forEach(m=>b[m]=function(){return b});
b.single=b.maybeSingle=function(){return Promise.resolve({data:rows[0]||null,error:null})};
b.then=function(res,rej){return Promise.resolve({data:rows,count:(D[t]||[]).length,error:null}).then(res,rej)};return b}
const sess={user:{id:'u1',email:'admin@brocfh.com',user_metadata:{full_name:'Admin User'}}};
window.supabase={createClient:()=>({from:B,rpc:()=>Promise.resolve({data:true,error:null}),auth:{getSession:async()=>({data:{session:sess}}),getUser:async()=>({data:{user:sess.user}}),signOut:async()=>({}),signInWithPassword:async()=>({data:{session:sess,user:sess.user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},storage:{from:()=>({upload:async()=>({data:{},error:null}),getPublicUrl:()=>({data:{publicUrl:''}})})}})}})();''' % json.dumps({'orders':orders,'products':prods,'enquiries':enq,'admin_audit':[{'id':1,'created_at':now.isoformat()+'Z','actor':'admin@brocfh.com','action':'order.status','detail':'#500 -> shipped'}],'admins':[{'email':'admin@brocfh.com'}]})
out=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1360,'height':860}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)[:200]))
    pg.on('console',lambda m:errs.append('CONSOLE '+m.text[:200]) if m.type=='error' and 'ERR_NAME' not in m.text else None)
    ctx.route('**/vendor/supabase-js-*.js',lambda r:r.fulfill(status=200,content_type='application/javascript',body=STUB))
    pg.goto('http://localhost:8765/admin.html'); pg.wait_for_timeout(2500)
    vis=pg.evaluate("document.getElementById('admin-app').style.display"); out.append(('app visible',vis))
    pg.screenshot(path='/tmp/qa_admin_dash.png')
    out.append(('kpi orders',pg.inner_text('#ds-sub-orders')[:30]))
    out.append(('insights bars',pg.locator('#ds-bars i').count()))
    pg.click('.sb-link[data-section="orders"]'); pg.wait_for_timeout(1200)
    out.append(('orders rows',pg.locator('#orders-tbody tr').count()))
    out.append(('orders pager',pg.inner_text('#pager-orders')[:40].replace('\n',' ')))
    out.append(('orders chips',pg.locator('#order-chips .chip').count()))
    out.append(('next-step buttons',pg.locator('#orders-tbody .btn-primary').count()))
    pg.locator('#orders-tbody .pg-r').first.check(); pg.wait_for_timeout(200)
    out.append(('bulkbar on',pg.evaluate("document.getElementById('bulkbar').classList.contains('on')")))
    pg.click('#bulkbar >> text=Clear'); 
    pg.click('#orders-tbody >> xpath=ancestor::table//th[@data-l="Total"]'); pg.wait_for_timeout(200)
    tot=pg.locator('#orders-tbody tr td:nth-child(5)').all_inner_texts()[:3]; out.append(('sorted totals',tot))
    pg.click('#pager-orders >> text=Next'); pg.wait_for_timeout(200); out.append(('page2',pg.inner_text('#pager-orders')[:30].replace('\n',' ')))
    pg.fill('#order-from','2099-01-01'); pg.dispatch_event('#order-from','change'); pg.wait_for_timeout(200)
    out.append(('future date -> rows',pg.locator('#orders-tbody tr').count())); pg.fill('#order-from',''); pg.dispatch_event('#order-from','change')
    pg.screenshot(path='/tmp/qa_admin_orders.png')
    pg.click('.sb-link[data-section="products"]'); pg.wait_for_timeout(1200)
    out.append(('products rows',pg.locator('#products-tbody tr').count())); out.append(('products pager',pg.inner_text('#pager-products')[:40].replace('\n',' ')))
    pg.locator('#products-tbody .pg-r').nth(1).check(); pg.wait_for_timeout(200); out.append(('prod bulk',pg.inner_text('#bulkbar')[:60].replace('\n',' ')))
    out.append(('bar before clear',pg.evaluate("document.getElementById('bulkbar').classList.contains('on')")))
    pg.click('#bulkbar button:last-child'); pg.wait_for_timeout(200)
    out.append(('bar after clear',pg.evaluate("document.getElementById('bulkbar').classList.contains('on')")))
    pg.click('.sb-link[data-section="reports"]'); pg.wait_for_timeout(1500)
    out.append(('report kpis',pg.locator('#rp-kpis .stat-card').count())); out.append(('report bars',pg.locator('#rp-bars i').count())); out.append(('top products',pg.locator('#rp-top li').count()))
    out.append(('bar on reports',pg.evaluate("document.getElementById('bulkbar').classList.contains('on')")))
    pg.screenshot(path='/tmp/qa_admin_reports.png',full_page=True)
    pg.click('.sb-link[data-section="enquiries"]'); pg.wait_for_timeout(600)
    pg.click('.sb-link[data-section="bulk-images"]'); pg.wait_for_timeout(600)
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(300); out.append(('cmdk open',pg.evaluate("document.getElementById('cmdk').classList.contains('open')"))); pg.keyboard.press('Escape')
    pg.evaluate("openAudit()"); pg.wait_for_timeout(700); out.append(('audit rows',pg.locator('.audit-row').count())); pg.evaluate("closeAudit()")
    for e in dict.fromkeys(errs): out.append(('ERR',e))
    b.close()
for o in out: print(*o)
