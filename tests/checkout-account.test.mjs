import { JSDOM } from 'jsdom'; import fs from 'fs';
const S=new URL('../', import.meta.url).pathname; let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
const tick=(ms=80)=>new Promise(r=>setTimeout(r,ms));
async function run(user){
  const html=fs.readFileSync(S+'contact.html','utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'');
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://armand.co.zw/contact.html',pretendToBeVisual:true});
  const w=dom.window; const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
  w.localStorage.setItem('arm_cart',JSON.stringify([{id:1,name:'Hinge',price:5,qty:1}]));
  const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:{full_name:'Alice Moyo',phone:'+263 78 111 2222'}})};
  const client={auth:{getSession:async()=>({data:{session:user?{user}:null}}),onAuthStateChange(){}},from:()=>q,rpc:async()=>({data:null,error:null})};
  w.Element.prototype.scrollTo=function(){}; w.supabase={createClient:()=>client}; w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},addEventListener(){}}));
  w.eval(fs.readFileSync(S+'armand-shop.js','utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded')); await tick();
  return {w,errs};
}
{ const {w,errs}=await run(null);
  ok(w.document.querySelector('a.nav-link[href="account.html"]').textContent==='Account','guest: menu says "Account"');
  if(w.Checkout){ w.Cart._items=[{id:1,name:'Hinge',price:5,qty:1}]; w.Checkout.open(); await tick();
    const n=w.document.getElementById('broc-acct-note'); ok(n&&/Sign in or create/.test(n.innerHTML)&&n.querySelector('a[href="account.html"]'),'guest: checkout shows sign-in note with link');
    ok(!w.document.getElementById('broc-co-name').value,'guest: checkout not prefilled'); } else ok(false,'Checkout not exposed '+errs.join(';'));
}
{ const {w}=await run({id:'u1',email:'alice@x.com',user_metadata:{full_name:'Alice Moyo'}});
  ok(w.document.querySelector('a.nav-link[href="account.html"]').textContent==='Hi, Alice','signed in: menu says "Hi, Alice"');
  w.Cart._items=[{id:1,name:'Hinge',price:5,qty:1}]; w.Checkout.open(); await tick(150);
  ok(/Signed in as alice@x.com/.test(w.document.getElementById('broc-acct-note').textContent),'signed in: note says order goes to My orders');
  ok(w.document.getElementById('broc-co-name').value==='Alice Moyo'&&w.document.getElementById('broc-co-phone').value==='+263 78 111 2222','signed in: name and phone prefilled from profile');
  // validation
  const set=(i,v)=>w.document.getElementById(i).value=v; const err=()=>w.document.getElementById('broc-co-error').innerHTML;
  set('broc-co-phone','abc'); await w.Checkout.placeOrder(); ok(/valid phone/.test(err()),'checkout: letters in phone rejected');
  set('broc-co-phone','+263 78 111 2222'); set('broc-co-name','A'); await w.Checkout.placeOrder(); ok(/full name/.test(err()),'checkout: one-letter name rejected');
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
