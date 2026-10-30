import { pool, query, transaction } from '../db/index.js';
import { SOURCE_ID, IMPORTER_VERSION, hash } from './normalizeKaikki.js';
import { mergeRecords } from './mergeRecords.js';
import { finalizeReleaseIdentities } from './identities.js';

export async function beginRelease(id, manifest) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(id)) throw new Error('Invalid release ID');
  if (!manifest.sourceUrl || !manifest.dumpDate || !manifest.extractorVersion) throw new Error('Manifest needs sourceUrl, dumpDate and extractorVersion');
  const result = await query(`INSERT INTO dictionary_releases(id,source_id,manifest) VALUES($1,$2,$3)
    ON CONFLICT(id) DO NOTHING RETURNING id`, [id, SOURCE_ID, { ...manifest, importerVersion: IMPORTER_VERSION }]);
  if (!result.rowCount) {
    const previous = (await query('SELECT status,manifest FROM dictionary_releases WHERE id=$1', [id])).rows[0];
    if (previous.status !== 'staging' && previous.status !== 'failed') throw new Error('Release is immutable after validation; choose a new release ID');
    if (previous.manifest.inputReceipt ? (manifest.sha256 && previous.manifest.sha256 && previous.manifest.sha256 !== manifest.sha256) : (!manifest.sha256 || previous.manifest.sha256 !== manifest.sha256)) throw new Error('Resuming an import requires the same verified full-source checksum; choose a new release ID');
    for (const field of ['sourceUrl','dumpDate','extractorVersion']) if (previous.manifest[field] !== manifest[field]) throw new Error(`Cannot resume a different source (${field})`);
    await query("UPDATE dictionary_releases SET status='staging',manifest=manifest || $2::jsonb WHERE id=$1", [id,JSON.stringify({reviewedExclusions:manifest.reviewedExclusions ?? previous.manifest.reviewedExclusions ?? []})]);
    return {inputReceipt:previous.manifest.inputReceipt ?? null};
  }
  return {inputReceipt:null};
}

export async function insertBatch(releaseId, records) {
  if (!records.length) return;
  const unique = new Map();
  for (const entry of records) {
    const previous = unique.get(entry.id);
    unique.set(entry.id, previous ? mergeRecords(previous,entry) : entry);
  }
  const rows = [...unique.values()];
  await transaction(async client => {
    const collision = await client.query(`SELECT e.entry_id,e.payload,e.content_hash FROM source_entries e
      JOIN jsonb_to_recordset($2::jsonb) AS x(id text,content_hash text) ON x.id=e.entry_id
      WHERE e.release_id=$1 AND e.content_hash<>x.content_hash`, [releaseId, JSON.stringify(rows.map(({ id, content_hash }) => ({ id, content_hash })))]);
    for (const stored of collision.rows) {
      const index=rows.findIndex(entry=>entry.id===stored.entry_id);
      const incoming=rows[index];
      rows[index]=mergeRecords({...incoming,payload:stored.payload,forms:stored.payload.forms,content_hash:stored.content_hash},incoming);
    }
    await client.query(`INSERT INTO entries(id,language,headword,part_of_speech,kind,lookup_key,folded_key,source_key)
      SELECT id,language,headword,part_of_speech,kind,lookup_key,folded_key,source_key
      FROM jsonb_to_recordset($1::jsonb) AS x(id text,language text,headword text,part_of_speech text,kind text,lookup_key text,folded_key text,source_key text)
      ON CONFLICT(id) DO NOTHING`, [JSON.stringify(rows.map(entry => ({id:entry.id,language:entry.language,headword:entry.headword,part_of_speech:entry.part_of_speech,kind:entry.kind,lookup_key:entry.lookup_key,folded_key:entry.folded_key,source_key:entry.source_key})))]);
    await client.query(`INSERT INTO source_entries(release_id,entry_id,payload,content_hash)
      SELECT $1,id,payload,content_hash FROM jsonb_to_recordset($2::jsonb) AS x(id text,payload jsonb,content_hash text)
      ON CONFLICT(release_id,entry_id) DO UPDATE SET payload=excluded.payload,content_hash=excluded.content_hash
      WHERE source_entries.content_hash<>excluded.content_hash`, [releaseId, JSON.stringify(rows.map(({ id, payload, content_hash }) => ({ id, payload, content_hash })))]);
    await client.query(`INSERT INTO forms(release_id,entry_id,form,lookup_key,folded_key,labels)
      SELECT $1,entry_id,form,lookup_key,folded_key,labels FROM jsonb_to_recordset($2::jsonb) AS x(entry_id text,form text,lookup_key text,folded_key text,labels text[])
      ON CONFLICT(release_id,entry_id,form) DO NOTHING`, [releaseId, JSON.stringify(rows.flatMap(entry => entry.forms.map(form => ({ entry_id: entry.id, form: form.form, lookup_key: form.lookup_key, folded_key: form.folded_key, labels: form.tags }))))]);
  });
}

export async function releaseCounts(releaseId) {
  return transaction(async client=>{
    await client.query("SET LOCAL work_mem='32MB'");
    await client.query('SET LOCAL max_parallel_workers_per_gather=0');
    // Never join/sort the large JSON payloads. Each payload aggregate streams.
    const payload=(await client.query(`SELECT count(*)::int AS entries,
      coalesce(sum(jsonb_array_length(payload->'senses'->0->'senses')),0)::int AS senses,
      count(*) FILTER (WHERE payload->>'kind'='idiom')::int AS idioms,
      count(*) FILTER (WHERE payload->>'kind'='phrasal verb')::int AS phrasal_verbs,
      count(*) FILTER (WHERE payload->>'kind'='proverb')::int AS proverbs,
      count(*) FILTER (WHERE jsonb_array_length(payload->'shortDefinitions')>0)::int AS entries_with_definitions,
      count(*) FILTER (WHERE payload->>'formOnly'='true')::int AS form_only_entries
      FROM source_entries WHERE release_id=$1`,[releaseId])).rows[0];
    // Narrow ID/text joins have bounded spill under the role's 256MB temp cap.
    const heads=(await client.query(`SELECT count(DISTINCT e.headword)::int AS headwords
      FROM entries e JOIN source_entries s ON s.entry_id=e.id WHERE s.release_id=$1`,[releaseId])).rows[0];
    const expressions=(await client.query(`SELECT count(*)::int AS expression_entries,
      count(DISTINCT e.headword)::int AS expression_headwords,
      count(DISTINCT e.headword) FILTER (WHERE position(' ' in e.lookup_key)>0)::int AS expressions,
      count(DISTINCT e.headword) FILTER (WHERE position(' ' in e.lookup_key)>0)::int AS multiword_headwords
      FROM entries e JOIN source_entries s ON s.entry_id=e.id WHERE s.release_id=$1
      AND (position(' ' in e.lookup_key)>0 OR e.part_of_speech IN ('phrase','proverb'))`,[releaseId])).rows[0];
    const extras=(await client.query(`SELECT
      (SELECT count(*)::int FROM forms WHERE release_id=$1) AS form_aliases,
      (SELECT count(*)::int FROM import_rejections WHERE release_id=$1) AS rejected`,[releaseId])).rows[0];
    return {...payload,...heads,...expressions,...extras};
  });
}

export async function normalizeReleaseKinds(releaseId,{client:providedClient}={}) {
  const client=providedClient ?? await pool.connect();
  let updated=0;
  try {
    await client.query('BEGIN');
    // Read the wide corpus once in physical order. Hash-ID ordering forces
    // random heap/TOAST reads; a sequential cursor bounds both I/O and Node RAM.
    await client.query('SET LOCAL enable_indexscan=off');
    await client.query('SET LOCAL enable_bitmapscan=off');
    await client.query(`DECLARE kind_candidates NO SCROLL CURSOR FOR
      SELECT entry_id,payload FROM source_entries WHERE release_id=$1 AND (
        (position(' ' in payload->>'word')=0 AND payload->>'sourcePartOfSpeech' NOT IN ('phrase','proverb') AND payload->>'kind'<>'word') OR
        (payload->>'kind'='phrasal verb' AND payload->>'sourcePartOfSpeech'<>'verb'))`,[releaseId]);
    while(true) {
      const {rows}=await client.query('FETCH 250 FROM kind_candidates');
      if(!rows.length) break;
      const updates=rows.flatMap(row=>{
        const payload={...row.payload};
        if(!/\s/u.test(payload.word) && !['phrase','proverb'].includes(payload.sourcePartOfSpeech)) payload.kind='word';
        else if(payload.kind==='phrasal verb' && payload.sourcePartOfSpeech!=='verb') payload.kind=payload.senses.some(group=>group.senses.some(sense=>sense.labels.includes('idiomatic'))) ? 'idiom' : 'expression';
        return payload.kind===row.payload.kind ? [] : [{id:row.entry_id,payload,kind:payload.kind,content_hash:hash(payload)}];
      });
      if(!updates.length) continue;
      await query(`UPDATE source_entries s SET payload=x.payload,content_hash=x.content_hash
        FROM jsonb_to_recordset($2::jsonb) AS x(id text,payload jsonb,content_hash text)
        WHERE s.release_id=$1 AND s.entry_id=x.id`,[releaseId,JSON.stringify(updates)]);
      await query(`UPDATE entries e SET kind=x.kind FROM jsonb_to_recordset($1::jsonb) AS x(id text,kind text) WHERE e.id=x.id AND e.kind<>x.kind`,[JSON.stringify(updates.map(({id,kind})=>({id,kind})))]);
      updated+=updates.length;
    }
    await client.query('CLOSE kind_candidates');
    await client.query('COMMIT');
    return updated;
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {if(!providedClient) client.release();}
}

export function unreviewedRejections(rejections, exclusions = []) {
  return rejections.filter(record => !exclusions.some(exclusion =>
    exclusion.kind === 'whitespace-only-headword' &&
    String(exclusion.lineNumber) === String(record.line_number) &&
    exclusion.sha256 === record.record_hash &&
    typeof exclusion.reason === 'string' && exclusion.reason.length >= 20 &&
    record.reason === 'invalid English headword or part of speech'
  ));
}

export async function validateRelease(id, { checksum, complete, inputCounts, expectedSha256, sample = false, client, checkResources = async () => {} }) {
  if (!checksum || !/^[a-f0-9]{64}$/.test(checksum)) throw new Error('Missing source checksum');
  const stored = (await query('SELECT manifest FROM dictionary_releases WHERE id=$1', [id])).rows[0];
  const expected = complete ? expectedSha256 ?? stored?.manifest.sha256 : null;
  if (expected && expected !== checksum) throw new Error('Source checksum mismatch');
  if (!complete && !sample) throw new Error('Partial input cannot be validated as a full release');
  const rejections=(await query('SELECT line_number,record_hash,reason FROM import_rejections WHERE release_id=$1',[id])).rows;
  const unreviewed=unreviewedRejections(rejections,stored?.manifest.reviewedExclusions);
  if(unreviewed.length) throw new Error(`Release has ${unreviewed.length} unreviewed rejection(s); publication refused`);
  await checkResources();
  await normalizeReleaseKinds(id,{client});
  await checkResources();
  await finalizeReleaseIdentities(id,{client});
  await checkResources();
  const counts = await releaseCounts(id);
  await checkResources();
  counts.reviewed_exclusions=rejections.length;
  counts.unreviewed_rejections=unreviewed.length;
  if (!counts.entries) throw new Error(`Release failed integrity checks: ${JSON.stringify(counts)}`);
  await query(`UPDATE dictionary_releases SET status='validated',completed_at=now(),counts=$2,
    manifest=manifest || $3::jsonb WHERE id=$1 AND status='staging'`, [id, { ...counts, ...inputCounts }, JSON.stringify({ sha256: checksum, complete, sample, checksumScope: complete ? 'complete compressed source bytes' : 'consumed compressed prefix (sample only)' })]);
  return counts;
}

export async function publishRelease(id, { allowSample = false } = {}) {
  return transaction(async client => {
    const { rows } = await client.query('SELECT * FROM dictionary_releases WHERE id=$1 FOR UPDATE', [id]);
    const release = rows[0];
    if (!release || !['validated','published'].includes(release.status)) throw new Error('Only a validated release may be published');
    if (release.manifest.sample && !allowSample) throw new Error('Sample publication requires allowSample');
    const previous = (await client.query('SELECT active_release_id FROM sources WHERE id=$1 FOR UPDATE', [release.source_id])).rows[0]?.active_release_id;
    if(release.status!=='published' && (!release.manifest.identityReconciled || release.manifest.identityReconciledAgainst!==previous)) throw new Error('Reconcile identities against the current release before publication');
    await client.query('UPDATE sources SET active_release_id=$2 WHERE id=$1', [release.source_id, id]);
    await client.query("UPDATE dictionary_releases SET status='published',published_at=now() WHERE id=$1", [id]);
    return { active: id, previous };
  });
}
