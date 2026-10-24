import { JSDOM } from 'jsdom';
import fs from 'fs';
const S=new URL('../', import.meta.url).pathname;
let pass=0, fail=0;
const ok=(c,m)=>{ c?pass++:fail++; console.log((c?'PASS ':'FAIL ')+m); };

/* ── 1. validators ── */
{
  const w=new JSDOM('',{runScripts:'outside-only'}).window; w.eval(fs.readFileSync(S+'validate.js','utf8')); const A=w.AV;
  ok(A.email('a@b.co')==='' ,'email: valid accepted');
  ok(A.email('a@b')!=='' && A.email('nope')!=='' && A.email('a @b.com')!=='' ,'email: malformed rejected');
  ok(A.email('',false)==='' && A.email('')!=='' ,'email: optional vs required');
  ok(A.phone('+263 78 079 3585')==='' && A.phone('0780793585')==='' ,'phone: Zimbabwe formats accepted');
  ok(A.phone('abc1234')!=='' && A.phone('123')!=='' && A.phone('1234567890123456')!=='' ,'phone: letters, too short, too long rejected');
  ok(A.password('abcdefg1')==='' ,'password: 8 chars + letter + number accepted');
  ok(A.password('short1')!=='' && A.password('allletters')!=='' && A.password('12345678')!=='' ,'password: short / no number / no letter rejected');
  ok(A.name('A')!=='' && A.name('Al')==='' && A.name('x'.repeat(101))!=='' ,'name: length limits');
  ok(A.number('-1',{min:0})!=='' && A.number('abc')!=='' && A.number('5',{min:0})==='' ,'number: range and type');
  ok(A.text('hi',5,10)!=='' && A.text('hello',5,10)==='' ,'text: min/max');
}

/* ── 2. account page flows with a fake Supabase ── */
function page(fake){
  const html=fs.readFileSync(S+'account.html','utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'');
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://armand.co.zw/account.html'});
  const w=dom.window; w.getSB=()=>fake; w.eval(fs.readFileSync(S+'bootstrap.bundle.min.js','utf8')); w.eval(fs.readFileSync(S+'validate.js','utf8')); w.eval(fs.readFileSync(S+'account.js','utf8'));
  return w;
}
const tick=()=>new Promise(r=>setTimeout(r,30));
const submit=(w,id)=>w.document.getElementById(id).dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
const set=(w,id,v)=>{const e=w.document.getElementById(id); if(e.type==='checkbox') e.checked=v; else e.value=v;};
const mk=(o={})=>({ calls:[], auth:{
  getSession: async()=>({data:{session:o.session||null}}),
  onAuthStateChange(){}, signOut: async function(){ o.session=null; },
  signUp: async function(a){ (o.calls??=[]).push(['signUp',a]); return o.signUpResult||{data:{user:{identities:[{}]},session:null},error:null}; },
  signInWithPassword: async function(a){ (o.calls??=[]).push(['signIn',a]); return o.signInResult||{data:{session:{}},error:null}; },
}, from(t){ return { select(){return this;}, eq(){return this;}, order(){return this;}, limit(){return Promise.resolve({data:o.orders||[],error:null});},
  maybeSingle: async()=>({data:{full_name:'Alice Moyo',phone:'+263781112222'}}) , update(){return this;} } }, _o:o });

{ // empty register: nothing sent, errors shown, focus on first bad field
  const o={}; const w=page(mk(o)); await tick();
  ok(!w.document.getElementById('viewAuth').hidden,'signed out: sign-in/register shown');
  w.document.getElementById('tabRegister').click(); submit(w,'registerForm'); await tick();
  ok(!(o.calls||[]).length,'register: empty form sends nothing to the server');
  ok(w.document.querySelectorAll('.field-error').length>=5,'register: inline errors on each bad field');
  ok(w.document.getElementById('reg-name').getAttribute('aria-invalid')==='true' && w.document.getElementById('reg-name').classList.contains('is-invalid'),'register: aria-invalid + Bootstrap is-invalid set');
  ok(w.document.getElementById('reg-terms-err') && w.document.getElementById('reg-terms').closest('.form-check').nextElementSibling===w.document.getElementById('reg-terms-err'),'register: checkbox error placed outside .form-check');
}
{ // password mismatch + weak
  const o={}; const w=page(mk(o)); await tick();
  set(w,'reg-name','Alice Moyo'); set(w,'reg-email','alice@x.com'); set(w,'reg-phone','+263 78 111 2222');
  set(w,'reg-pass','abcdefg1'); set(w,'reg-pass2','abcdefg2'); set(w,'reg-terms',true); submit(w,'registerForm'); await tick();
  ok(!(o.calls||[]).length && w.document.getElementById('reg-pass2-err'),'register: mismatched passwords blocked');
}
{ // happy path, email confirmation on
  const o={}; const w=page(mk(o)); await tick();
  set(w,'reg-name','Alice Moyo'); set(w,'reg-email','alice@x.com'); set(w,'reg-phone','+263 78 111 2222');
  set(w,'reg-pass','Cedar-Plank-4417'); set(w,'reg-pass2','Cedar-Plank-4417'); set(w,'reg-terms',true); submit(w,'registerForm'); await tick();
  const c=(o.calls||[]).find(x=>x[0]==='signUp');
  ok(c && c[1].email==='alice@x.com' && c[1].options.data.full_name==='Alice Moyo','register: valid form calls signUp with name/phone metadata');
  ok(!w.document.getElementById('acctMsg').hidden && /confirmation link/.test(w.document.getElementById('acctMsg').textContent),'register: tells user to confirm email');
  await tick(); ok(w.document.getElementById('panelLogin').classList.contains('active') && !w.document.getElementById('panelRegister').classList.contains('active'),'register: Bootstrap tab switches to sign-in');
}
{ // honeypot
  const o={}; const w=page(mk(o)); await tick(); set(w,'reg-website','bot'); submit(w,'registerForm'); await tick();
  ok(!(o.calls||[]).length,'register: honeypot silently blocks bots');
}
{ // password policy beyond the basic validator
  const o={}; const w=page(mk(o)); await tick();
  set(w,'reg-name','Test User'); set(w,'reg-email','t@x.com'); set(w,'reg-phone','0771234567');
  set(w,'reg-pass','Abcdefg12'); set(w,'reg-pass2','Abcdefg12'); set(w,'reg-terms',true); submit(w,'registerForm'); await tick();
  ok(!(o.calls||[]).some(c=>c[0]==='signUp'),'register: 9-character password refused by policy (min 10)');
}
{ // duplicate email (Supabase returns empty identities)
  const o={signUpResult:{data:{user:{identities:[]},session:null},error:null}}; const w=page(mk(o)); await tick();
  set(w,'reg-name','Alice Moyo'); set(w,'reg-email','alice@x.com'); set(w,'reg-phone','0781112222');
  set(w,'reg-pass','Cedar-Plank-4417'); set(w,'reg-pass2','Cedar-Plank-4417'); set(w,'reg-terms',true); submit(w,'registerForm'); await tick();
  ok(/If this email is new/.test(w.document.getElementById('acctMsg').textContent) && !/already exists/.test(w.document.getElementById('acctMsg').textContent),'register: duplicate email does not reveal that the account exists');
}
{ // bad login
  const o={signInResult:{data:{},error:{message:'Invalid login credentials'}}}; const w=page(mk(o)); await tick();
  set(w,'log-email','alice@x.com'); set(w,'log-pass','wrongpass1'); submit(w,'loginForm'); await tick();
  ok(w.document.getElementById('acctMsg').textContent==='Incorrect email or password.','login: wrong password gives a friendly message');
  ok(w.document.getElementById('log-pass').value==='','login: password field cleared after failure');
}
{ // empty login
  const o={}; const w=page(mk(o)); await tick(); submit(w,'loginForm'); await tick();
  ok(!(o.calls||[]).length,'login: empty form sends nothing');
}
{ // signed-in: orders listed, HTML escaped
  const o={session:{user:{id:'u1',email:'alice@x.com',user_metadata:{}}},orders:[{id:7,created_at:'2026-10-01T10:00:00Z',status:'pending',total:'12.50',payment_method:'EcoCash',items:[{name:'<img src=x onerror=alert(1)>',qty:2}]}]};
  const w=page(mk(o)); await tick(); await tick();
  const d=w.document;
  ok(!d.getElementById('viewAccount').hidden && d.getElementById('viewAuth').hidden,'signed in: account view shown, sign-in hidden');
  ok(d.querySelector('#ordersList .card .badge.bg-secondary')&&/Order #7/.test(d.getElementById('ordersList').innerHTML) && /USD 12.50/.test(d.getElementById('ordersList').innerHTML),'signed in: My orders lists order # and total');
  ok(!d.getElementById('ordersList').querySelector('img'),'signed in: malicious item name is escaped (no XSS)');
  ok(d.getElementById('welcomeName').textContent==='Alice','signed in: welcome uses first name');
  ok(d.getElementById('pf-email').readOnly,'signed in: email is read-only');
}
{ // signed in, no orders
  const o={session:{user:{id:'u1',email:'a@x.com',user_metadata:{}}},orders:[]}; const w=page(mk(o)); await tick(); await tick();
  ok(/No orders yet/.test(w.document.getElementById('ordersList').textContent),'signed in: empty state message');
}
{ // sign out
  const o={session:{user:{id:'u1',email:'a@x.com',user_metadata:{}}},orders:[]}; const w=page(mk(o)); await tick(); await tick();
  w.document.getElementById('logoutBtn').click(); await tick(); await tick();
  ok(!w.document.getElementById('viewAuth').hidden,'sign out: returns to sign-in view');
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
