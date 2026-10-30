import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdtemp, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { registerEntryPronunciations, hash } from '../src/services/pronunciationService.js';
import { prepareAudio, readAudio } from '../src/repositories/audio.js';
import { reserveAllowance, allowanceStatus, verifyDispatchAllowance } from '../src/services/providerBudget.js';
import { reconcileAudio } from '../scripts/reconcile-audio.js';
import { runWorkerOnce } from '../src/workers/audioWorker.js';

const connectionString=process.env.TEST_DATABASE_URL;
test('PostgreSQL audio deduplication, quota races, worker locking, and persisted recovery',{skip:!connectionString},async t=>{
    const schema=`audio_test_${randomUUID().replaceAll('-','')}`;
    const admin=new pg.Pool({connectionString,max:1});
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool=new pg.Pool({connectionString,max:5,options:`-c search_path=${schema},public`});
    const db={pool,query:(sql,args)=>pool.query(sql,args),transaction:async work=>{
        const client=await pool.connect();
        try {await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}
        catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }};
    const directory=await mkdtemp(join(tmpdir(),'word-atlas-audio-db-'));
    const enabled=process.env.AUDIO_SYNTHESIS_ENABLED;
    const originalAudioDir=process.env.AUDIO_DIR;
    process.env.AUDIO_DIR=directory;
    process.env.AUDIO_SYNTHESIS_ENABLED='true';
    t.after(async()=>{
        if(enabled===undefined)delete process.env.AUDIO_SYNTHESIS_ENABLED;else process.env.AUDIO_SYNTHESIS_ENABLED=enabled;
        if(originalAudioDir===undefined)delete process.env.AUDIO_DIR;else process.env.AUDIO_DIR=originalAudioDir;
        await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();
        await rm(directory,{recursive:true,force:true});
    });
    await db.query('CREATE TABLE entries(id text PRIMARY KEY)');
    await db.query(await readFile(new URL('../migrations/004_pronunciation_audio.sql',import.meta.url),'utf8'));
    await db.query(await readFile(new URL('../migrations/005_audio_safety.sql',import.meta.url),'utf8'));
    await db.query("INSERT INTO entries(id) VALUES('test-entry')");
    const pronunciations=await registerEntryPronunciations({id:'test-entry',word:'lead',sourceSounds:[{ipa:'/lɛd/'}],senses:[]},db);
    const id=pronunciations[0].id;
    assert.equal((await prepareAudio(id,'user',db)).reason,'allowance_unverified');
    const {rows:[grant]}=await db.query(`INSERT INTO provider_allowances(provider,period_start,period_end,character_limit,verified_until,verification_evidence)
        VALUES('google-chirp3-hd',date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',(date_trunc('month',now() AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC',100000,LEAST(now()+interval '1 hour',(date_trunc('month',now() AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC'),'Synthetic test allocation; no real synthesis permitted') RETURNING id`);
    const requests=await Promise.all(Array.from({length:20},()=>prepareAudio(id,'user',db)));
    assert.ok(requests.every(result=>result.status==='pending'));
    assert.equal((await db.query('SELECT count(*)::int AS count FROM audio_jobs')).rows[0].count,1);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM provider_usage')).rows[0].count,0);

    const bytes=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(200)]);
    let calls=0;
    const options={database:db,directory,processFile:copyFile,inspect:async()=>({checksum:hash(bytes),byteSize:bytes.length,duration:1}),
        getToken:async()=>'mock',diskCheck:async()=>{},synthesize:async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,40));return bytes;}};
    const workerResults=await Promise.all([runWorkerOnce(options),runWorkerOnce(options)]);
    assert.ok(workerResults.includes('ready'));
    assert.equal(calls,1);
    assert.equal((await readAudio(id,db)).status,'ready');
    assert.equal((await db.query('SELECT state FROM provider_usage')).rows[0].state,'consumed');
    process.env.AUDIO_SYNTHESIS_ENABLED='false';
    assert.equal((await prepareAudio(id,'user',db)).status,'ready');
    await runWorkerOnce(options);
    assert.equal(calls,1);

    // Missing media is explicitly unavailable even though metadata says ready.
    const ready=await readAudio(id,db);
        await rm(join(directory,`${ready.assetKey}.mp3`));
    assert.equal((await readAudio(id,db)).reason,'cached_file_missing');
    assert.equal((await prepareAudio(id,'user',db)).reason,'cached_file_missing');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM audio_jobs')).rows[0].count,1);
    // Restoring the saved bytes restores readiness; no replacement provider request exists.
    const recovered=await reconcileAudio({database:db,directory,assetKey:ready.assetKey,inspect:options.inspect,processFile:copyFile});
    assert.equal(recovered.providerRequests,0);
    assert.equal(recovered.results[0].status,'ready');
    assert.equal(recovered.results[0].checksum,hash(bytes));
    assert.equal((await readAudio(id,db)).status,'ready');
    assert.equal(calls,1);

    await db.query('UPDATE provider_allowances SET revoked_at=now() WHERE id=$1',[grant.id]);
    const {rows:[raceGrant]}=await db.query(`INSERT INTO provider_allowances(provider,period_start,period_end,character_limit,verified_until,verification_evidence)
        VALUES('google-chirp3-hd',now(),(date_trunc('month',now() AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC',21,
            LEAST(now()+interval '1 hour',(date_trunc('month',now() AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC'),
            'Synthetic test allocation for quota race boundary') RETURNING id`);
    const assetKeys=Array.from({length:12},(_,i)=>hash(`budget-${i}`));
    for(const key of assetKeys)await db.query("INSERT INTO audio_assets(asset_key,config,status)VALUES($1,'{}','pending')",[key]);
    const results=await Promise.all(assetKeys.map(key=>db.transaction(client=>reserveAllowance(client,key,7))));
    assert.equal(results.filter(result=>result.status==='reserved').length,3);
    assert.equal(results.filter(result=>result.status==='allowance_exhausted').length,9);
    const reserved=assetKeys[results.findIndex(result=>result.status==='reserved')];
    assert.equal((await db.transaction(client=>reserveAllowance(client,reserved,7))).status,'already_reserved');
    assert.equal(await verifyDispatchAllowance(db,reserved),true);
    // Simultaneously active grants are never additive and cannot authorize dispatch.
    await db.query('UPDATE provider_allowances SET revoked_at=NULL WHERE id=$1',[grant.id]);
    assert.equal((await allowanceStatus(db)).reason,'allowance_unverified');
    assert.equal(await verifyDispatchAllowance(db,reserved),false);
    await db.query('UPDATE provider_allowances SET revoked_at=now() WHERE id=ANY($1::bigint[])',[[grant.id,raceGrant.id]]);
    assert.equal(await verifyDispatchAllowance(db,reserved),false);
    assert.equal((await allowanceStatus(db)).reason,'allowance_unverified');
    await assert.rejects(db.query(`INSERT INTO provider_allowances(provider,period_start,period_end,character_limit,verified_until,verification_evidence)
        VALUES('google-chirp3-hd',now(),now()+interval '1 year',100,now()+interval '1 year','Invalid future allowance must be rejected')`),error=>error.code==='23514');
    await assert.rejects(db.query(`INSERT INTO provider_allowances(provider,period_start,period_end,character_limit,verified_until,verification_evidence)
        VALUES('google-chirp3-hd',now()+interval '1 month',now()+interval '2 months',100,now()+interval '2 months','Invalid future allowance must be rejected')`),error=>error.code==='23514');
    // Regression: verification expires while a competing transaction holds the budget lock.
    const {rows:[expiring]}=await db.query(`INSERT INTO provider_allowances(provider,period_start,period_end,character_limit,verified_until,verification_evidence)
        VALUES('google-chirp3-hd',now(),(date_trunc('month',now() AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC',100,
            clock_timestamp()+interval '2 seconds','Synthetic expiring allowance for lock-wait regression') RETURNING verified_until`);
    const holder=await pool.connect();
    await holder.query('BEGIN');await holder.query("SELECT pg_advisory_xact_lock(hashtext('word-atlas-google-budget'))");
    const waiting=db.transaction(client=>reserveAllowance(client,assetKeys[11],7));
    await new Promise(resolve=>setTimeout(resolve,2200));
    await holder.query('COMMIT');holder.release();
    assert.ok(Date.now()>new Date(expiring.verified_until).getTime());
    assert.equal((await waiting).reason,'allowance_unverified');
});
