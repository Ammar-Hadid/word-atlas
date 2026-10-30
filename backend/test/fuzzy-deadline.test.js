import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestions } from '../src/repositories/entries.js';
import { queryWithTimeout,query,pool } from '../src/db/index.js';

test('optional fuzzy cancellation returns no guesses while real database failures remain visible',async()=>{
    const args={releaseId:'fixture',fuzzy:true,query:async()=>({rows:[]})};
    assert.deepEqual(await suggestions('typo',{...args,fuzzyQuery:async()=>{throw Object.assign(new Error('deadline'),{code:'57014'});}}),[]);
    await assert.rejects(suggestions('typo',{...args,fuzzyQuery:async()=>{throw Object.assign(new Error('unavailable'),{code:'08006'});}}),/unavailable/);
});

const enabled=Boolean(process.env.TEST_DATABASE_URL)&&process.env.DATABASE_URL===process.env.TEST_DATABASE_URL;
test('PostgreSQL cancels expensive optional work and returns a clean connection to its pool',{skip:!enabled},async t=>{
    t.after(()=>pool.end());
    const before=(await query('SHOW statement_timeout')).rows[0].statement_timeout;
    const start=performance.now();
    await assert.rejects(queryWithTimeout('SELECT pg_sleep(5)',[],100),error=>error.code==='57014');
    assert.ok(performance.now()-start<1500,'The five-second query should be canceled, not allowed to finish');
    assert.equal((await query('SELECT 1 AS alive')).rows[0].alive,1);
    assert.equal((await query('SHOW statement_timeout')).rows[0].statement_timeout,before);
});
