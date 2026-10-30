import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { lines, checkDisk } from '../src/import/streamKaikki.js';
import { normalizeKaikki } from '../src/import/normalizeKaikki.js';
import { beginRelease, insertBatch, validateRelease, publishRelease, releaseCounts, unreviewedRejections } from '../src/import/releases.js';
import { lookupTerm, suggestions } from '../src/repositories/entries.js';
import { pool, query } from '../src/db/index.js';

test('stream preserves Unicode across chunks and refuses oversized records', async () => {
  const input = Buffer.from('café\nnext\n');
  const output=[];
  for await (const line of lines(Readable.from([input.subarray(0,4),input.subarray(4)]))) output.push(line);
  assert.deepEqual(output,['café','next']);
  await assert.rejects(async () => { for await (const line of lines(Readable.from([Buffer.alloc(100)]),10)) void line; }, /byte limit/);
  await assert.rejects(checkDisk('.',Number.MAX_SAFE_INTEGER), /Low disk/);
});

test('staging, repeat import, rollback, exact case, forms, phrases and stable tombstones', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  assert.ok(process.env.DATABASE_URL===process.env.TEST_DATABASE_URL,'Integration suite only runs against designated test database');
  const prefix=`corpus-test-${randomUUID()}`;
  const oldActive=(await query("SELECT active_release_id FROM sources WHERE id='wiktionary-en'")).rows[0].active_release_id;
  const ids=[`${prefix}-a`,`${prefix}-b`,`${prefix}-bad`,`${prefix}-refresh`];
  t.after(async () => {
    await query("UPDATE sources SET active_release_id=$1 WHERE id='wiktionary-en'",[oldActive]);
    await query('DELETE FROM forms WHERE release_id=ANY($1)',[ids]);
    await query('DELETE FROM source_entries WHERE release_id=ANY($1)',[ids]);
    await query('DELETE FROM dictionary_identity_events WHERE release_id=ANY($1)',[ids]);
    await query('DELETE FROM dictionary_releases WHERE id=ANY($1)',[ids]);
    await pool.end();
  });
  const manifest={sourceUrl:'https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz',dumpDate:'2026-10-01',extractorVersion:'synthetic-fixture',sha256:'a'.repeat(64)};
  const records=[
    {word:'serendipity',pos:'noun',senses:[{glosses:['Synthetic definition.']}],forms:[{form:'serendipities',tags:['plural']}]},
    {word:'spill the beans',pos:'verb',senses:[{glosses:['Synthetic idiom.'],tags:['idiomatic']}]},
    {word:'US',pos:'name',senses:[{glosses:['Synthetic uppercase abbreviation.']}]},
    {word:'us',pos:'pron',senses:[{glosses:['Synthetic lowercase pronoun.']}]},
  ].map(record=>normalizeKaikki({...record,lang_code:'en'}));
  await beginRelease(ids[0],manifest);
  await insertBatch(ids[0],records);
  await beginRelease(ids[0],manifest);
  await assert.rejects(beginRelease(ids[0],{...manifest,sha256:'f'.repeat(64)}),/same verified full-source checksum/);
  await insertBatch(ids[0],records);
  assert.equal((await releaseCounts(ids[0])).entries,4);
  const variant=normalizeKaikki({word:'serendipity',pos:'noun',lang_code:'en',senses:[{glosses:['Synthetic definition.']}],forms:[{form:'serendipities',tags:['plural']}],related:[{word:'happy accident'}]});
  await insertBatch(ids[0],[variant]);
  await insertBatch(ids[0],records);
  const merged=(await lookupTerm('serendipity',{releaseId:ids[0]})).word[0];
  assert.equal(merged.relations.related[0].word,'happy accident');
  assert.equal(merged.sourceVariantHashes.length,2);
  await assert.rejects(publishRelease(ids[0]),/validated/);
  await validateRelease(ids[0],{checksum:'a'.repeat(64),complete:true,inputCounts:{}});
  await publishRelease(ids[0]);
  assert.equal((await lookupTerm('serendipity')).word[0].word,'serendipity');
  assert.equal((await lookupTerm('serendipities')).matchType,'form');
  assert.equal((await lookupTerm('spill   the beans')).word[0].kind,'idiom');
  assert.equal((await lookupTerm('US')).word[0].partOfSpeech,'proper noun');
  assert.equal((await lookupTerm('us')).word[0].partOfSpeech,'pronoun');
  assert.equal((await lookupTerm('Us')).word.length,0);
  assert.ok((await suggestions('ser')).includes('serendipity'));
  assert.ok((await suggestions('serendipitty',{fuzzy:true})).includes('serendipity'));
  await beginRelease(ids[1],{...manifest,sha256:'b'.repeat(64)});
  await insertBatch(ids[1],[records[0]]);
  await validateRelease(ids[1],{checksum:'b'.repeat(64),complete:true,inputCounts:{}});
  const publish=await publishRelease(ids[1]);
  assert.equal(publish.previous,ids[0]);
  assert.equal((await lookupTerm('spill the beans')).word.length,0);
  assert.equal((await query('SELECT id FROM entries WHERE id=$1',[records[1].id])).rowCount,1);
  await publishRelease(ids[0]);
  assert.equal((await lookupTerm('spill the beans')).word.length,1);
  await beginRelease(ids[3],{...manifest,sha256:'d'.repeat(64)});
  const changed=normalizeKaikki({word:'serendipity',lang_code:'en',pos:'noun',senses:[{glosses:['Synthetic definition!']}],forms:[{form:'serendipities',tags:['plural']}]});
  assert.notEqual(changed.id,records[0].id);
  await insertBatch(ids[3],[changed]);
  await query('UPDATE dictionary_releases SET manifest=manifest || $2::jsonb WHERE id=$1',[ids[3],JSON.stringify({inputReceipt:{checksum:'d'.repeat(64),complete:true,sample:false,counters:{english_records:1}}})]);
  await validateRelease(ids[3],{checksum:'d'.repeat(64),complete:true,inputCounts:{}});
  const refreshed=(await lookupTerm('serendipity',{releaseId:ids[3]})).word[0];
  assert.equal(refreshed.id,records[0].id,'unambiguous gloss edit preserves durable entry ID');
  assert.ok(refreshed.senses[0].senses[0].id.startsWith(records[0].id+':'));
  assert.equal((await lookupTerm('serendipities',{releaseId:ids[3]})).word[0].id,records[0].id);
  assert.equal((await query('SELECT entry_id FROM entry_identity_aliases WHERE signature=$1',[changed.id])).rows[0].entry_id,records[0].id);
  await query("UPDATE dictionary_releases SET status='failed' WHERE id=$1",[ids[3]]);
  const resumed=await beginRelease(ids[3],{...manifest,sha256:'d'.repeat(64)});
  assert.equal(resumed.inputReceipt.complete,true,'restart resumes finalization without raw re-ingestion');
  await assert.rejects(beginRelease(ids[3],{...manifest,sha256:'f'.repeat(64)}),/same verified full-source checksum/);
  await validateRelease(ids[3],{checksum:'d'.repeat(64),complete:true,inputCounts:{}});
  assert.equal((await releaseCounts(ids[3])).entries,1);
  assert.equal((await lookupTerm('serendipity',{releaseId:ids[3]})).word[0].id,records[0].id);
  await beginRelease(ids[2],{...manifest,sha256:'c'.repeat(64)});
  await insertBatch(ids[2],[records[0]]);
  await insertBatch(ids[2],[normalizeKaikki({word:'serendipity',lang_code:'en',pos:'noun',senses:[{glosses:['Different source sense block.']}]})]);
  assert.equal((await releaseCounts(ids[2])).entries,2);
  await assert.rejects(validateRelease(ids[2],{checksum:'c'.repeat(64),complete:false,inputCounts:{}}),/Partial/);
  assert.equal((await lookupTerm('spill the beans')).word.length,1);
});

test('reviewed exclusions require exact line/hash and cannot waive malformed JSON', () => {
  const record={line_number:'12',record_hash:'a'.repeat(64),reason:'invalid English headword or part of speech'};
  const approved={kind:'whitespace-only-headword',lineNumber:12,sha256:'a'.repeat(64),reason:'Whitespace-only source punctuation cannot be searched.'};
  assert.equal(unreviewedRejections([record],[approved]).length,0);
  assert.equal(unreviewedRejections([record],[{...approved,lineNumber:13}]).length,1);
  assert.equal(unreviewedRejections([record],[{...approved,sha256:'b'.repeat(64)}]).length,1);
  assert.equal(unreviewedRejections([{...record,reason:'Unexpected token in JSON'}],[approved]).length,1);
});
