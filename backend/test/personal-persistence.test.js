import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, query } from '../src/db/index.js';
import { importItems, listItems, saveItem, removeItem, clearHistory } from '../src/repositories/library.js';
import { createApp } from '../src/server.js';
import { createSetupToken, passkeyConfig } from '../src/auth/passkeys.js';
import { createSoftPasskey } from './helpers/softPasskey.js';

const enabled=Boolean(process.env.TEST_DATABASE_URL)&&process.env.DATABASE_URL===process.env.TEST_DATABASE_URL;
test('personal persistence, owner sessions, CSRF, migration, isolation and idempotency',{skip:!enabled},async t=>{
    const user=randomUUID(),other=randomUUID(),username=`test-${user}`;
    await query('INSERT INTO users(id,username) VALUES($1,$2),($3,$4)',[user,username,other,`test-${other}`]);
    const originalGate=process.env.LOGIN_PATH;
    const gate=process.env.LOGIN_PATH='test-secret-sign-in-path';
    await query("DELETE FROM request_limits WHERE bucket='passkey'"); // earlier runs from this machine count toward the limit
    const server=createApp().listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    t.after(async()=>{
        await new Promise(resolve=>server.close(resolve));
        for(const table of ['personal_operations','saved_entries','search_history'])await query(`DELETE FROM ${table} WHERE user_id=ANY($1)`,[[user,other]]);
        await query('DELETE FROM sessions WHERE sess::jsonb->>\'userId\'=ANY($1)',[[user,other]]);
        await query('DELETE FROM passkeys WHERE user_id=ANY($1)',[[user,other]]);
        await query('DELETE FROM passkey_setup_tokens WHERE user_id=ANY($1)',[[user,other]]);
        if(originalGate===undefined)delete process.env.LOGIN_PATH;else process.env.LOGIN_PATH=originalGate;
        await query('DELETE FROM users WHERE id=ANY($1)',[[user,other]]);await pool.end();
    });
    const origin=process.env.APP_ORIGIN,url=`http://127.0.0.1:${server.address().port}`;
    let cookie='',csrf='';
    async function request(path,method='GET',body,headers={}){
        const res=await fetch(`${url}/api${path}`,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':csrf,...headers},body:body===undefined?undefined:JSON.stringify(body)});
        if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
        const data=await res.json();if(data.csrfToken)csrf=data.csrfToken;
        return {res,data};
    }
    assert.equal((await request('/me/library')).res.status,401);
    await request('/auth/me');
    // Without the secret path, the passkey endpoints look like they don't exist.
    assert.equal((await request('/auth/passkey/gate?gate=wrong-guess-of-the-path')).res.status,404);
    assert.equal((await request('/auth/passkey/login/options','POST',{gate:'wrong-guess-of-the-path'})).res.status,404);
    assert.equal((await request(`/auth/passkey/gate?gate=${gate}`)).res.status,200);
    assert.equal((await request('/auth/passkey/login/options','POST',{gate},{Origin:'https://evil.invalid'})).res.status,403);
    assert.equal((await request('/auth/passkey/login/options','POST',{gate},{'X-CSRF-Token':'bad'})).res.status,403);
    assert.equal((await request('/auth/passkey/login/options','POST',{gate},{'X-CSRF-Token':'é'.repeat(48)})).res.status,403);
    // First passkey: a one-time setup link registers it and signs the owner in.
    const passkey=createSoftPasskey(passkeyConfig());
    const token=await createSetupToken(user);
    assert.equal((await request('/auth/passkey/setup/options','POST',{gate,token:'not-a-real-token'})).res.status,410);
    const setup=await request('/auth/passkey/setup/options','POST',{gate,token});
    assert.equal(setup.res.status,200);assert.equal(setup.data.authenticatorSelection.residentKey,'required');
    const registered=await request('/auth/passkey/setup/verify','POST',{gate,token,response:passkey.register(setup.data)});
    assert.equal(registered.res.status,200);assert.equal(registered.data.user.id,user);
    assert.equal((await request('/auth/passkey/setup/options','POST',{gate,token})).res.status,410); // links work once
    assert.equal((await request('/auth/logout','POST',{})).res.status,200);
    await request('/auth/me');const before=cookie;
    // A stranger's passkey and a replayed challenge are both refused.
    const stranger=createSoftPasskey(passkeyConfig());
    const foreign=await request('/auth/passkey/login/options','POST',{gate});
    assert.equal((await request('/auth/passkey/login/verify','POST',{gate,response:stranger.authenticate(foreign.data)})).res.status,401);
    const challenge=await request('/auth/passkey/login/options','POST',{gate});
    const login=await request('/auth/passkey/login/verify','POST',{gate,response:passkey.authenticate(challenge.data)});
    assert.equal(login.res.status,200);assert.equal(login.data.user.id,user);
    assert.notEqual(cookie,before);assert.match(login.res.headers.get('set-cookie'),/HttpOnly/);assert.match(login.res.headers.get('set-cookie'),/SameSite=Lax/);
    assert.equal((await query('SELECT counter FROM passkeys WHERE user_id=$1',[user])).rows[0].counter,'2');
    assert.equal((await request('/auth/passkey/login/verify','POST',{gate,response:passkey.authenticate(challenge.data)})).res.status,401);
    assert.equal((await request('/auth/me')).data.user.id,user);
    const at=Date.now()-60000;
    const legacy={saved:[{word:'unresolved-personal-term',savedAt:at,definition:'PROPRIETARY SENTINEL'}],history:[{word:'unresolved-personal-term',visitedAt:at}]};
    assert.equal((await request('/me/import','POST',{saved:[],history:[{word:'missing timestamp'}]})).res.status,400);
    assert.equal((await request('/me/library/test','PUT')).res.status,400);
    const imported=await request('/me/import','POST',legacy);assert.equal(imported.data.imported,2);
    assert.equal((await request('/me/import','POST',legacy)).data.imported,0);
    assert.equal((await request('/me/history')).data.items[0].visitCount,1);
    assert.equal((await request('/me/library')).data.items[0].savedAt,at);
    assert.equal((await listItems(other,'saved')).total,0);
    const raw=await query('SELECT row_to_json(s)::text AS text FROM saved_entries s WHERE user_id=$1',[user]);assert.ok(!raw.rows[0].text.includes('PROPRIETARY'));
    const event={word:'unresolved-personal-term',visitedAt:Date.now()};
    await Promise.all(Array.from({length:8},()=>saveItem(user,event,'history','concurrent-test-event')));
    assert.equal((await listItems(user,'history')).items[0].visitCount,2);
    await assert.rejects(saveItem(user,{...event,word:'different'},'history','concurrent-test-event'),{status:409});
    const history=Array.from({length:65},(_,i)=>({word:`pagination-term-${i}`,visitedAt:at-i*1000}));
    await importItems(user,{saved:[],history});
    const p=await listItems(user,'history',{offset:0,limit:50});assert.equal(p.items.length,50);assert.equal(p.nextOffset,50);assert.equal(p.total,66);
    assert.equal((await listItems(user,'history',{offset:50,limit:50})).items.length,16);
    await removeItem(other,'unresolved-personal-term','other-removal-123');assert.equal((await listItems(user,'saved')).total,1);
    const privatePage=await request('/me/library');assert.match(privatePage.res.headers.get('cache-control'),/no-store/);
    await clearHistory(user,'clear-history-123');assert.equal((await listItems(user,'history')).total,0);
    await importItems(user,legacy);assert.equal((await listItems(user,'history')).total,0); // retry cannot resurrect cleared import
    const exportResponse=await request('/me/export');assert.equal(exportResponse.data.saved.length,1);
    const oldCookie=cookie;assert.equal((await request('/auth/logout','POST',{})).res.status,200);
    cookie=oldCookie;assert.equal((await request('/me/library')).res.status,401);
});
