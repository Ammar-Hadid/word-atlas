import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatamuseService, freeAccessVerified, reserveDatamuse } from '../src/services/datamuseService.js';

const response = data => ({ ok: true, json: async () => data });
const beforeDeadline = () => true;

test('same-term concurrent requests reserve six once and reuse normalized cache', async () => {
    let reservations = 0, calls = 0;
    const get = createDatamuseService({ freeAccess: beforeDeadline, reserve: async count => { reservations += count; return true; }, fetchImpl: async url => {
        calls++;
        const params = new URL(url).searchParams;
        if (params.has('rel_syn')) return response([{ word: 'guide' }, { word: 'guide' }, { word: 'lead' }, { word: 'Paris', tags: ['prop'] }, { word: 'multi word' }]);
        if (params.has('sp')) return response([{ word: 'lead', numSyllables: 1, tags: ['f:42'], defs: ['must not persist'] }]);
        return response([]);
    } });
    const results = await Promise.all(Array.from({ length: 20 }, () => get('lead')));
    assert.equal(calls, 6); assert.equal(reservations, 6);
    assert.deepEqual(results[0].synonyms, ['guide']);
    assert.equal(results[0].frequency, 42); assert.equal(results[0].syllableCount, 1);
    assert.equal(results[0].availability, 'available');
    assert.equal(JSON.stringify(results[0]).includes('must not persist'), false);
    await get('LEAD'); assert.equal(calls, 6);
});

test('expired, malformed, unverified extended allowances fail closed', () => {
    assert.equal(freeAccessVerified({ now: Date.parse('2026-12-31T23:59:59Z'), disabled: false }), true);
    assert.equal(freeAccessVerified({ now: Date.parse('2027-01-01T00:00:00Z'), disabled: false }), false);
    assert.equal(freeAccessVerified({ now: 0, until: 'invalid', disabled: false }), false);
    assert.equal(freeAccessVerified({ now: 0, until: '2027-02-01', evidence: '', disabled: false }), false);
    assert.equal(freeAccessVerified({ now: 0, until: '2027-02-01', evidence: 'Verified free provider access in operator record.', disabled: false }), true);
});

test('unverified/exhausted/database-failed allowance makes zero provider calls', async () => {
    let calls = 0;
    for (const options of [{ freeAccess: () => false }, { reserve: async () => false }, { reserve: async () => { throw new Error('database offline'); } }]) {
        const get = createDatamuseService({ freeAccess: beforeDeadline, reserve: async () => true, fetchImpl: async () => { calls++; return response([]); }, ...options });
        assert.deepEqual((await get('lead')).synonyms, []);
    }
    assert.equal(calls, 0);
});

test('partial outages and unresponsive providers meet deadline without hiding successful results', async () => {
    const get = createDatamuseService({ freeAccess: beforeDeadline, reserve: async () => true, timeoutMs: 15,
        fetchImpl: async url => new URL(url).searchParams.has('rel_syn') ? response([{ word: 'guide' }]) : new Promise(() => {}) });
    const start = performance.now(); const result = await get('lead');
    assert.equal(result.availability, 'partial'); assert.deepEqual(result.synonyms, ['guide']);
    assert.ok(performance.now() - start < 250);
});

test('cache expires and evicts old entries; malformed metadata is not presented', async () => {
    let clock = 0, reservations = 0;
    const get = createDatamuseService({ freeAccess: beforeDeadline, reserve: async () => { reservations++; return true; }, now: () => clock, ttlMs: 10, maxEntries: 1,
        fetchImpl: async () => response([{ word: 'other', tags: ['f:NaN'], numSyllables: -2 }]) });
    assert.equal((await get('lead')).frequency, null); await get('lead'); assert.equal(reservations, 1);
    await get('word'); await get('lead'); assert.equal(reservations, 3);
    clock = 11; await get('lead'); assert.equal(reservations, 4);
});

test('quota transaction reserves the whole six-call batch at the boundary', async () => {
    const queries = [];
    const transact = async work => work({ query: async (sql, values) => { queries.push({ sql, values }); return { rows: [{ used: 9995 }] }; } });
    assert.equal(await reserveDatamuse(6, { transact, freeAccess: beforeDeadline }), false);
    assert.equal(queries.some(item => item.sql.startsWith('INSERT')), false);
    queries.length = 0;
    const accepted = async work => work({ query: async (sql, values) => { queries.push({ sql, values }); return { rows: [{ used: 9994 }] }; } });
    assert.equal(await reserveDatamuse(6, { transact: accepted, freeAccess: beforeDeadline }), true);
    assert.match(queries[0].sql, /pg_advisory_xact_lock/);
    assert.deepEqual(queries.at(-1).values, [6]);
});

test('invalid queries do not reserve allowance', async () => {
    let reserved = false;
    const get = createDatamuseService({ reserve: async () => { reserved = true; return true; } });
    await assert.rejects(get(''), { status: 400 });
    await assert.rejects(get('a'.repeat(201)), { status: 400 });
    assert.equal(reserved, false);
});

test('PostgreSQL concurrent boundary admits only two six-request reservations', { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const { default: pg } = await import('pg');
    const { randomBytes } = await import('node:crypto');
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
    const schema = `datamuse_test_${randomBytes(8).toString('hex')}`;
    try {
        await pool.query(`CREATE SCHEMA ${schema}`);
        await pool.query(`CREATE TABLE ${schema}.editorial_usage(reference text NOT NULL,used_at timestamptz NOT NULL DEFAULT now())`);
        const transact = async work => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query(`SET LOCAL search_path TO ${schema}`);
                const result = await work(client);
                await client.query('COMMIT'); return result;
            } catch (error) { await client.query('ROLLBACK'); throw error; }
            finally { client.release(); }
        };
        const results = await Promise.all(Array.from({ length: 10 }, () => reserveDatamuse(6, { transact, dailyLimit: 12, freeAccess: beforeDeadline })));
        assert.equal(results.filter(Boolean).length, 2);
        assert.equal((await pool.query(`SELECT count(*)::int count FROM ${schema}.editorial_usage`)).rows[0].count, 12);
    } finally {
        // Only this test's newly created, random-named schema is removed.
        await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await pool.end();
    }
});
