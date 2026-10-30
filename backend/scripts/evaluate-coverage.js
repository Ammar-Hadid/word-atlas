import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';
import { lookupTerm } from '../src/repositories/entries.js';
import { releaseCounts } from '../src/import/releases.js';
import { pool, query, transaction } from '../src/db/index.js';
const { values } = parseArgs({ options: { release:{type:'string'}, cases:{type:'string',default:'test/fixtures/dictionary-cases.json'}, output:{type:'string'} } });
try {
  const fixture = JSON.parse(await readFile(values.cases,'utf8'));
  const cases = Array.isArray(fixture) ? fixture : fixture.coverageTerms;
  const releaseId = values.release ?? (await query("SELECT active_release_id FROM sources WHERE id='wiktionary-en'")).rows[0]?.active_release_id;
  if (!releaseId) throw new Error('Specify a release or publish one before evaluation');
  const release=(await query('SELECT status,counts FROM dictionary_releases WHERE id=$1',[releaseId])).rows[0];
  const counts=['validated','published'].includes(release?.status) ? release.counts : await releaseCounts(releaseId);
  const results=[], categories={};
  for (const item of cases) {
    const started=performance.now();
    const result=await lookupTerm(item.term,{releaseId});
    const found=result.word.length>0;
    results.push({ ...item,found,matchType:result.matchType,entryCount:result.word.length,
      examples:result.word.reduce((count,entry)=>count+entry.senses.flatMap(group=>group.senses).reduce((n,sense)=>n+sense.examples.length,0),0),
      formResolution:result.word.map(entry=>entry.formResolution?.status).filter(Boolean),latencyMs:Math.round((performance.now()-started)*10)/10 });
    categories[item.category] ??= { found:0,total:0 };
    categories[item.category].total++;
    categories[item.category].found+=Number(found);
  }
  const latency=results.map(row=>row.latencyMs).sort((a,b)=>a-b);
  const sizes=(await query("SELECT pg_database_size(current_database())::text AS database_bytes,pg_total_relation_size('entries')::text AS entries_bytes,pg_total_relation_size('source_entries')::text AS source_entries_bytes,pg_total_relation_size('forms')::text AS forms_bytes")).rows[0];
  const punctuation="’‘ʼ‐‑‒–—−", replacement="'''------";
  const whitespace='[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+';
  const integrity=await transaction(async client=>{
    await client.query("SET LOCAL work_mem='32MB'");
    await client.query('SET LOCAL max_parallel_workers_per_gather=0');
    const base=(await client.query(`SELECT count(*)::int AS checked_entries,
      count(*) FILTER (WHERE payload->>'id' IS DISTINCT FROM entry_id)::int AS payload_id_mismatches,
      count(*) FILTER (WHERE jsonb_array_length(payload->'shortDefinitions')=0)::int AS entries_without_definitions
      FROM source_entries WHERE release_id=$1`,[releaseId])).rows[0];
    // OFFSET 0 preserves a projection boundary: hash/sort nodes see only the
    // ID and normalized key, never the full JSON payload. Verify with EXPLAIN.
    const keys=(await client.query(`SELECT count(*)::int AS exact_lookup_key_mismatches FROM
      (SELECT entry_id,btrim(regexp_replace(translate(normalize(payload->>'word',NFC),$2,$3),$4,' ','g')) AS expected_key
       FROM source_entries WHERE release_id=$1 OFFSET 0) expected
      LEFT JOIN entries e ON e.id=expected.entry_id
      WHERE expected.expected_key IS DISTINCT FROM e.lookup_key`,[releaseId,punctuation,replacement,whitespace])).rows[0];
    const links=(await client.query(`SELECT
      (SELECT count(*)::int FROM forms f WHERE f.release_id=$1 AND NOT EXISTS(SELECT 1 FROM source_entries se WHERE se.release_id=f.release_id AND se.entry_id=f.entry_id)) AS orphan_forms,
      (SELECT count(*)::int FROM entries e JOIN source_entries s ON s.entry_id=e.id WHERE s.release_id=$1 AND e.language<>'en') AS non_english_entries`,[releaseId])).rows[0];
    return {...base,...keys,...links};
  });
  if(integrity.checked_entries!==counts.entries || integrity.payload_id_mismatches || integrity.exact_lookup_key_mismatches || integrity.non_english_entries || integrity.orphan_forms) process.exitCode=1;
  const report={releaseId,integrity,evaluatedAt:new Date().toISOString(),counts,sizes,categories,
    lookupLatency:{p50Ms:latency[Math.floor(latency.length*.5)],p95Ms:latency[Math.floor(latency.length*.95)],measurement:'Sequential database-backed lookups, no provider calls; includes network to database if run remotely'},results};
  const text=JSON.stringify(report,null,2)+'\n';
  if(values.output) await writeFile(values.output,text);
  console.log(text);
} finally {await pool.end();}
