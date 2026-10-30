import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAudioRouter } from '../src/routes/audioRoutes.js';

test('audio API refuses unauthenticated writes and untrusted IDs without touching data',async t=>{
    let queries=0;
    const app=express();
    app.use('/api/pronunciations',createAudioRouter({requireAuth:(req,res)=>res.status(401).json({error:'Sign in.'}),
        database:{query:async()=>{queries++;return {rows:[]};},transaction:async()=>{throw new Error('Must not run.');}}}));
    const server=app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    t.after(()=>new Promise(resolve=>server.close(resolve)));
    const base=`http://127.0.0.1:${server.address().port}/api/pronunciations`;
    const unauthorized=await fetch(`${base}/${'a'.repeat(64)}/audio`,{method:'POST'});
    assert.equal(unauthorized.status,401);
    assert.equal(unauthorized.headers.get('cache-control'),'private, no-store');
    assert.equal(queries,0);
    const invalid=await fetch(`${base}/arbitrary-text-to-speech/audio`,{method:'POST'});
    assert.equal(invalid.status,400);
    assert.equal(queries,0);
    const missing=await fetch(`${base}/${'b'.repeat(64)}/audio`);
    assert.equal(missing.status,404);
    assert.equal(missing.headers.get('cache-control'),'private, no-store');
    assert.equal(queries,1);
});
