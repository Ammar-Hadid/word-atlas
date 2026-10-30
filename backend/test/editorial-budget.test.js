import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { reserveEditorial } from '../src/services/merriamService.js';
import { query, pool } from '../src/db/index.js';
const enabled=Boolean(process.env.TEST_DATABASE_URL)&&process.env.DATABASE_URL===process.env.TEST_DATABASE_URL;
test('editorial rolling allowance is atomic, separate per reference and restart-persistent',{skip:!enabled},async t=>{
    const first=`test-learners-${randomUUID()}`,second=`test-collegiate-${randomUUID()}`;
    const priorLimit=process.env.MW_DAILY_LIMIT,priorAfter=process.env.MW_ENABLE_AFTER;
    process.env.MW_DAILY_LIMIT='2';delete process.env.MW_ENABLE_AFTER;
    t.after(async()=>{
        if(priorLimit===undefined)delete process.env.MW_DAILY_LIMIT;else process.env.MW_DAILY_LIMIT=priorLimit;
        if(priorAfter===undefined)delete process.env.MW_ENABLE_AFTER;else process.env.MW_ENABLE_AFTER=priorAfter;
        await query('DELETE FROM editorial_usage WHERE reference=ANY($1)',[[first,second]]);await pool.end();
    });
    assert.equal((await Promise.all(Array.from({length:12},()=>reserveEditorial(first)))).filter(Boolean).length,2);
    assert.equal(await reserveEditorial(second),true);
    assert.equal((await query('SELECT count(*)::int AS n FROM editorial_usage WHERE reference=$1',[first])).rows[0].n,2);
    assert.equal(await reserveEditorial(first),false);
    await query("UPDATE editorial_usage SET used_at=now()-interval '25 hours' WHERE reference=$1",[first]);
    assert.equal(await reserveEditorial(first),true);
    process.env.MW_ENABLE_AFTER='2099-01-01T00:00:00Z';assert.equal(await reserveEditorial(second),false);
});
