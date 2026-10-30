import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAudioRouter } from '../src/routes/audioRoutes.js';

test('audio API rate-limits visitors, rejects untrusted IDs and never caches answers',async t=>{
    let queries=0,limited=false;
    const database={query:async()=>{queries++;return {rows:[]};},transaction:async work=>work({query:async()=>{queries++;return {rows:[]};}})};
    const app=express();
    app.use('/api/pronunciations',createAudioRouter({database,
        identifyUser:(req,_res,next)=>{req.user=req.get('X-Test-Owner')?{id:'owner'}:null;next();},
        limitVisitor:async()=>!limited}));
    const server=app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    t.after(()=>new Promise(resolve=>server.close(resolve)));
    const base=`http://127.0.0.1:${server.address().port}/api/pronunciations`;
    const invalid=await fetch(`${base}/arbitrary-text-to-speech/audio`,{method:'POST'});
    assert.equal(invalid.status,400);
    assert.equal(queries,0);
    const missing=await fetch(`${base}/${'b'.repeat(64)}/audio`);
    assert.equal(missing.status,404);
    assert.equal(missing.headers.get('cache-control'),'private, no-store');
    // Visitors may request recordings of real entries until their hourly limit.
    assert.equal((await fetch(`${base}/${'a'.repeat(64)}/audio`,{method:'POST'})).status,404);
    limited=true;
    const before=queries;
    assert.equal((await fetch(`${base}/${'a'.repeat(64)}/audio`,{method:'POST'})).status,429);
    assert.equal(queries,before);
    // The signed-in owner is not subject to the visitor limit.
    assert.equal((await fetch(`${base}/${'a'.repeat(64)}/audio`,{method:'POST',headers:{'X-Test-Owner':'1'}})).status,404);
});
