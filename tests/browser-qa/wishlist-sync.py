exec(open('/tmp/shopqa.py').read().split("log=[]")[0])
STUB='''(function(){window.__calls=[];const server=[{product_id:"103"}];const cbs=[];
const sess={user:{id:"u1",email:"c@x.com",user_metadata:{full_name:"Cust Omer"}}};
function B(t){const b={};b.select=()=>b;b.limit=()=>b;b.eq=(k,v)=>{b._eq=(b._eq||[]).concat([[k,v]]);return b};
b.upsert=(r,o)=>{window.__calls.push(["upsert",t,JSON.stringify(r)]);return Promise.resolve({error:null})};
b.delete=()=>{b._del=1;return b};
b.then=(res,rej)=>{if(b._del)window.__calls.push(["delete",t,JSON.stringify(b._eq)]);return Promise.resolve({data:t==="wishlist"?server:[],error:null}).then(res,rej)};return b}
window.__fire=ev=>cbs.forEach(f=>f(ev,ev==="SIGNED_OUT"?null:sess));
window.supabase={createClient:()=>({from:B,rpc:()=>Promise.resolve({data:null,error:null}),auth:{getSession:async()=>({data:{session:window.__out?null:sess}}),getUser:async()=>({data:{user:sess.user}}),signOut:async()=>({}),onAuthStateChange:f=>{cbs.push(f);setTimeout(()=>f("INITIAL_SESSION",sess),30);return{data:{subscription:{unsubscribe(){}}}}}}})}})();'''
def h2(route):
    if 'vendor/supabase-js' in route.request.url: route.fulfill(status=200,content_type='application/javascript',body=STUB)
    else: handler(route)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1280,'height':800}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:160]))
    ctx.add_init_script("localStorage.setItem('armand_wish', JSON.stringify(['101','102']))")
    ctx.route('**/*',h2)
    pg.goto('http://localhost:8765/products.html'); pg.wait_for_timeout(2200)
    ls=lambda: sorted(pg.evaluate("JSON.parse(localStorage.getItem('armand_wish')||'[]')"))
    print('1 merged list on this device:',ls(),'(expected 101,102,103)')
    print('2 sent to account:',[c for c in pg.evaluate("window.__calls") if c[0]=='upsert'])
    print('3 nav heart count:',pg.inner_text('#navWishN'),'| saved hearts lit on page:',pg.evaluate("[...document.querySelectorAll('.pcard .wish.on')].map(e=>e.dataset.pid).sort()"))
    pg.evaluate("window.__calls.length=0")
    pg.evaluate("document.querySelector('.pcard .wish[data-pid=\"103\"]').click()"); pg.wait_for_timeout(500)
    print('4 un-save 103 ->',[c for c in pg.evaluate("window.__calls") if c[0]=='delete'],'| local now:',ls())
    pg.evaluate("window.__calls.length=0"); pg.evaluate("document.querySelector('.pcard .wish[data-pid=\"105\"]').click()"); pg.wait_for_timeout(500)
    print('5 save 105 ->',[c for c in pg.evaluate("window.__calls") if c[0]=='upsert'])
    pg.evaluate("window.__out=true; window.__fire('SIGNED_OUT')"); pg.wait_for_timeout(500)
    print('6 after sign-out: local list:',ls(),'| nav count hidden:',pg.evaluate("document.getElementById('navWishN').hidden"),'| lit hearts:',pg.evaluate("document.querySelectorAll('.pcard .wish.on').length"))
    print('errors:',errs); b.close()
