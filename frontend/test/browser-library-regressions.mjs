// Run with an existing Playwright installation; no application dependency is added.
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
const root=fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
const origin=process.env.WA_ORIGIN || 'http://localhost:5173';
const browser=await chromium.launch({...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),headless:true});
const report={origin,api:'isolated mock; no remote personal data',startedAt:new Date().toISOString(),checks:[],errors:[],providerRequests:0};
const check=(name,ok,detail)=>{report.checks.push({name,ok,detail});if(!ok)throw new Error(name+': '+JSON.stringify(detail));};
const user={id:'isolated-browser-fixture',username:'isolated-browser-fixture'};
const emptyInsights={synonyms:[],antonyms:[],similar:[],associated:[],rhymes:[],frequency:null,syllableCount:null};
let offline=false,authenticated=true,latePage=false,releasePage,requestedPage;
const pageGate=new Promise(resolve=>releasePage=resolve),pageRequested=new Promise(resolve=>requestedPage=resolve);
const saved=new Map(),history=new Map(),delivered=[],ids=new Set();
const c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await c.route('**/api/**',async route=>{
 const request=route.request(),url=new URL(request.url()),path=url.pathname;
 if(!path.startsWith('/api/'))return route.continue();
 if(offline)return route.abort('internetdisconnected');
 const json=body=>route.fulfill({json:body});
 if(path==='/api/auth/me')return json({user:authenticated?user:null,csrfToken:'isolated-fixture-csrf'});
 if(path==='/api/auth/logout'){authenticated=false;return json({user:null,csrfToken:'isolated-fixture-next'});}
 if(path==='/api/insights')return json(emptyInsights);
 if(path==='/api/words'){
  const word=url.searchParams.get('term');return json({word:[{id:'fixture-'+word,word,partOfSpeech:'noun',pronunciations:[],forms:[],phrases:[],senses:[{senses:[{id:word+'-sense',definition:'Original synthetic browser test definition.',examples:[],usageNotes:[],labels:[]}]}]}],quotes:[]});
 }
 if(path==='/api/me/import')return json({verified:true});
 if(request.method()==='GET'&&path==='/api/me/library'){
  const offset=Number(url.searchParams.get('offset')||0),all=[...saved.values()];
  if(offset&&latePage){requestedPage();await pageGate;return json({items:[{word:'private-delayed-owner-word',savedAt:1700000000000}],total:101,nextOffset:null});}
  return json({items:all.slice(offset,offset+100),total:all.length,nextOffset:all.length>offset+100?offset+100:null});
 }
 if(request.method()==='GET'&&path==='/api/me/history')return json({items:[...history.values()],total:history.size,nextOffset:null});
 if(request.method()==='GET'&&path.startsWith('/api/me/library/'))return json({item:saved.get(decodeURIComponent(path.split('/').at(-1)))??null});
 if(request.method()==='PUT'&&path.startsWith('/api/me/library/')){
  const body=request.postDataJSON(),id=request.headers()['idempotency-key'];if(!ids.has(id)){saved.set(body.word,body);delivered.push({id,word:body.word});ids.add(id);}return json({item:body});
 }
 if(request.method()==='POST'&&path==='/api/me/history'){
  const body=request.postDataJSON(),id=request.headers()['idempotency-key'];if(!ids.has(id)){history.set(body.word,body);ids.add(id);}return json({item:body});
 }
 report.providerRequests++;return route.fulfill({status:500,json:{error:'Unexpected request in isolated test: '+path}});
});
try{
 const a=await c.newPage(),b=await c.newPage();for(const p of [a,b])p.on('pageerror',e=>report.errors.push(e.message));
 await Promise.all([a.goto(origin+'/word/cat'),b.goto(origin+'/word/dog')]);
 await Promise.all([a.getByRole('button',{name:'Save to library (S)',exact:true}).waitFor(),b.getByRole('button',{name:'Save to library (S)',exact:true}).waitFor()]);
 for(let i=0;i<30&&history.size<2;i++)await new Promise(r=>setTimeout(r,100));
 await a.evaluate(()=>{localStorage.setItem('wa:outbox:v1','[]');localStorage.setItem('wa:saved','[]');localStorage.setItem('wa:history','[]');});
 await new Promise(r=>setTimeout(r,250));offline=true;await c.setOffline(true);
 await Promise.all([a.getByRole('button',{name:'Save to library (S)',exact:true}).click(),b.getByRole('button',{name:'Save to library (S)',exact:true}).click()]);
 await Promise.all([a.getByRole('button',{name:'Remove from library (S)',exact:true}).waitFor(),b.getByRole('button',{name:'Remove from library (S)',exact:true}).waitFor()]);
 const durable=await a.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('wa:outbox:v2:operation:')).map(k=>JSON.parse(localStorage.getItem(k))).filter(x=>x.kind==='save'));
 check('Concurrent offline saves in separate tabs retain both durable operations',durable.length===2&&durable.some(x=>x.word==='cat')&&durable.some(x=>x.word==='dog'),durable.map(({id,word})=>({id,word})));
 await Promise.all([a.close(),b.close()]);offline=false;await c.setOffline(false);
 const reopened=await c.newPage();reopened.on('pageerror',e=>report.errors.push(e.message));await reopened.goto(origin+'/library');await reopened.getByText('Your library is synchronized across devices.',{exact:true}).waitFor();
 check('Closing both tabs and reopening delivers both saves once',saved.has('cat')&&saved.has('dog')&&delivered.length===2,delivered);
 check('Recovered library shows both words',await reopened.getByRole('link',{name:'cat',exact:true}).count()===1&&await reopened.getByRole('link',{name:'dog',exact:true}).count()===1);
 const storage=await reopened.evaluate(()=>({operations:Object.keys(localStorage).filter(k=>k.startsWith('wa:outbox:v2:operation:')),originals:['wa:outbox:v1','wa:saved','wa:history'].map(k=>localStorage.getItem(k))}));
 check('Acknowledged operation keys clear while original recovery keys remain',storage.operations.length===0&&storage.originals.every(x=>x==='[]'),storage);
 // A delayed private second page must not be installed after logout.
 saved.clear();for(let i=0;i<101;i++)saved.set('private-owner-'+i,{word:'private-owner-'+i,savedAt:1700000000000+i});
 await reopened.reload();await reopened.getByText('Your library is synchronized across devices.',{exact:true}).waitFor();latePage=true;
 await reopened.getByRole('button',{name:'Load more',exact:true}).click();await pageRequested;
 await reopened.getByRole('button',{name:'Sign out',exact:true}).click();await reopened.getByRole('button',{name:'Sign in',exact:true}).waitFor();releasePage();await reopened.waitForTimeout(700);
 check('Delayed owner pagination does not appear after logout',await reopened.getByText('private-delayed-owner-word',{exact:true}).count()===0&&await reopened.getByRole('link',{name:/private-owner-/}).count()===0);
 check('Logout clears pagination controls and owner totals',await reopened.getByRole('button',{name:'Load more',exact:true}).count()===0&&!/101/.test(await reopened.locator('main').innerText()));
 check('No uncaught browser exceptions or external provider requests',report.errors.length===0&&report.providerRequests===0,{errors:report.errors,providerRequests:report.providerRequests});report.passed=true;
}catch(e){report.failure=e.message;}finally{releasePage();await browser.close();report.finishedAt=new Date().toISOString();await fs.writeFile(root+'/docs/verification/offline-tabs'+(origin.includes('localhost')?'':'-production')+'-results.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
