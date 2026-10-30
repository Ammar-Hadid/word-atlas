import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetPath, processAudioJob, publishBytes, recoverFile, validateMp3Header, leadingTrimSeconds } from '../src/workers/audioWorker.js';
import { hash } from '../src/services/pronunciationService.js';

const bytes = Buffer.concat([Buffer.from('ID3'),Buffer.alloc(200)]);
const metadata = {checksum:hash(bytes),byteSize:bytes.length,duration:1.2};
const key = hash('synthetic-test-clip');
const job = {asset_key:key,config:{text:'lead',phoneme:'lɛd',language:'en-US',voice:'en-US-Chirp3-HD-Iapetus',format:'MP3',speakingRate:1}};
const mockClient = () => ({queries:[],async query(sql,params) {this.queries.push({sql,params});return {rows:[],rowCount:1};}});
async function fixture(t) {
    const directory=await mkdtemp(join(tmpdir(),'word-atlas-audio-test-'));
    t.after(()=>rm(directory,{recursive:true,force:true}));
    return directory;
}
const processFile=async(source,destination)=>{await copyFile(source,destination);return{removedSeconds:0};};
const defaults = client => ({client,processFile,verifyDispatch:async()=>true,inspect:async()=>metadata,diskCheck:async()=>{},getToken:async()=>'test',reserve:async()=>({status:'reserved'}),enabled:()=>true});

test('publish validates magic, stores atomically, and reuses complete files',async t=>{
    const directory=await fixture(t);
    assert.throws(()=>validateMp3Header(Buffer.from('<html>')));
    await publishBytes(directory,key,bytes,async()=>metadata,processFile);
    assert.deepEqual(await readFile(assetPath(directory,key)),bytes);
    assert.deepEqual(await publishBytes(directory,key,bytes,async()=>metadata,processFile),metadata);
});

test('crash after completed temporary write recovers file without another synthesis',async t=>{
    const directory=await fixture(t);
    await writeFile(assetPath(directory,key,true),bytes);
    let calls=0;
    const client=mockClient();
    const result=await processAudioJob({...job,dispatched_at:new Date()},{...defaults(client),directory,synthesize:async()=>{calls++;return bytes;}});
    assert.equal(result,'recovered');
    assert.equal(calls,0);
    assert.deepEqual(await readFile(assetPath(directory,key)),bytes);
    assert.ok(client.queries.some(q=>q.sql.includes("status='ready'")));
});

test('unknown provider outcome retains usage and never sends again',async t=>{
    const directory=await fixture(t);
    let calls=0;
    const client=mockClient();
    const options={...defaults(client),directory,synthesize:async()=>{calls++;throw new Error('timeout');}};
    assert.equal(await processAudioJob(job,options),'uncertain');
    assert.equal(calls,1);
    assert.equal(await processAudioJob({...job,dispatched_at:new Date()},options),'uncertain');
    assert.equal(calls,1);
    assert.ok(client.queries.some(q=>q.sql.includes("state='uncertain'")));
});

test('low disk and unknown or exhausted allowance never dispatch',async t=>{
    const directory=await fixture(t);
    let calls=0;
    const client=mockClient();
    const options={...defaults(client),directory,synthesize:async()=>{calls++;return bytes;}};
    assert.equal(await processAudioJob(job,{...options,diskCheck:async()=>{throw new Error('low_disk');}}),'unavailable');
    assert.equal(await processAudioJob(job,{...options,reserve:async()=>({status:'allowance_exhausted',reason:'allowance_exhausted'})}),'allowance_exhausted');
    assert.equal(await processAudioJob(job,{...options,enabled:()=>false}),'unavailable');
    assert.equal(calls,0);
});

test('successful publication can be replayed after restart with generation disabled',async t=>{
    const directory=await fixture(t);
    let calls=0;
    const client=mockClient();
    const options={...defaults(client),directory,synthesize:async()=>{calls++;return bytes;}};
    assert.equal(await processAudioJob(job,options),'ready');
    assert.equal(await processAudioJob(job,{...options,enabled:()=>false}),'recovered');
    assert.equal(calls,1);
});

test('corrupt completed data is held for inspection and never retried after dispatch',async t=>{
    const directory=await fixture(t);
    await writeFile(assetPath(directory,key,true),Buffer.from('corrupt'));
    let calls=0;
    const client=mockClient();
    assert.equal(await processAudioJob({...job,dispatched_at:new Date()},{...defaults(client),directory,
        inspect:async()=>{throw new Error('invalid_audio_header');},synthesize:async()=>{calls++;return bytes;}}),'uncertain');
    assert.equal(calls,0);
    await assert.rejects(recoverFile(directory,key,async()=>{throw new Error('bad');}),/invalid_audio_header/);
});

test('leading trim preserves padding and never removes interior silence',()=>{
    assert.equal(leadingTrimSeconds('silence_start: 0\nsilence_end: 0.7'),0.6);
    assert.equal(leadingTrimSeconds('silence_start: 0.02\nsilence_end: 0.7'),0);
    assert.equal(leadingTrimSeconds('silence_start: 0\nsilence_end: 0.05'),0);
    assert.equal(leadingTrimSeconds('no verified silence'),0);
});
test('processing failure retains original and recovery does not synthesize again',async t=>{
    const directory=await fixture(t);
    const client=mockClient();
    let calls=0;
    const options={...defaults(client),directory,synthesize:async()=>{calls++;return bytes;}};
    assert.equal(await processAudioJob(job,{...options,processFile:async()=>{throw new Error('encoder_failed');}}),'uncertain');
    assert.deepEqual(await readFile(join(directory,`${key}.source.mp3`)),bytes);
    assert.equal(await processAudioJob({...job,dispatched_at:new Date()},options),'recovered');
    assert.equal(calls,1);
});

test('expiry or revocation at the final dispatch gate sends zero provider requests',async t=>{
    const directory=await fixture(t);const client=mockClient();let calls=0;
    const result=await processAudioJob(job,{...defaults(client),directory,verifyDispatch:async()=>false,
        synthesize:async()=>{calls++;return bytes;}});
    assert.equal(result,'unavailable');assert.equal(calls,0);
    assert.ok(client.queries.some(query=>query.params?.includes('allowance_expired_before_dispatch')));
});
