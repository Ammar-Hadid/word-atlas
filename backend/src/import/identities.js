import { pool, query, transaction } from '../db/index.js';
import { hash } from './normalizeKaikki.js';

export function planFamilyMappings(previous, current) {
  const mappings=[], ambiguous=[];
  const claimed=new Set(), retained=new Set();
  const targets=new Map();
  for (const record of current) {
    const target=record.alias ?? record.id;
    const members=targets.get(target) ?? [];
    members.push(record); targets.set(target,members);
  }
  for (const [target,records] of targets) {
    if(records.length>1) { ambiguous.push({reason:'multiple current signatures refer to one prior entry',target,signatures:records.map(record=>record.id)}); continue; }
    const record=records[0];
    if(record.alias || previous.includes(record.id)) {
      retained.add(record.id); claimed.add(target);
      if(record.id!==target) mappings.push({from:record.id,to:target,reason:'known_signature'});
    }
  }
  const oldRemaining=previous.filter(id=>!claimed.has(id));
  const newRemaining=current.filter(record=>!retained.has(record.id));
  if(!ambiguous.length && oldRemaining.length===1 && newRemaining.length===1) {
    mappings.push({from:newRemaining[0].id,to:oldRemaining[0],reason:'single_unmatched_source_family'});
  } else if(oldRemaining.length && newRemaining.length) {
    ambiguous.push({reason:'source family has multiple unmatched alternatives',previous:oldRemaining,current:newRemaining.map(record=>record.id)});
  }
  return {mappings,ambiguous};
}

function rewriteIds(value, from, to) {
  if(Array.isArray(value)) return value.map(item=>rewriteIds(item,from,to));
  if(!value || typeof value!=='object') return value;
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[
    key,key==='id' && typeof item==='string' && (item===from || item.startsWith(from+':')) ? to+item.slice(from.length) : rewriteIds(item,from,to),
  ]));
}

async function applyFamily(releaseId, sourceId, family, plan) {
  if(!plan.mappings.length && !plan.ambiguous.length) return;
  await transaction(async client=>{
    for(const mapping of plan.mappings) {
      const {rows}=await client.query('SELECT payload FROM source_entries WHERE release_id=$1 AND entry_id=$2 FOR UPDATE',[releaseId,mapping.from]);
      if(!rows.length) continue; // A completed mapping is safe to revisit after a crash.
      const payload=rewriteIds(rows[0].payload,mapping.from,mapping.to);
      payload.identity={sourceSignature:mapping.from,stableEntryId:mapping.to,reason:mapping.reason};
      await client.query('INSERT INTO source_entries(release_id,entry_id,payload,content_hash) VALUES($1,$2,$3,$4)',[releaseId,mapping.to,payload,hash(payload)]);
      await client.query(`INSERT INTO forms(release_id,entry_id,form,lookup_key,folded_key,labels)
        SELECT release_id,$3,form,lookup_key,folded_key,labels FROM forms WHERE release_id=$1 AND entry_id=$2`,[releaseId,mapping.from,mapping.to]);
      await client.query('DELETE FROM forms WHERE release_id=$1 AND entry_id=$2',[releaseId,mapping.from]);
      await client.query('DELETE FROM source_entries WHERE release_id=$1 AND entry_id=$2',[releaseId,mapping.from]);
      await client.query(`INSERT INTO entry_identity_aliases(signature,entry_id,family_key,source_id) VALUES($1,$2,$3,$4)
        ON CONFLICT(signature) DO UPDATE SET ambiguous=entry_identity_aliases.entry_id<>excluded.entry_id`,[mapping.from,mapping.to,family,sourceId]);
    }
    for(const [kind,details] of [['mapped',plan.mappings],['ambiguous',plan.ambiguous]]) if(details.length) {
      await client.query(`INSERT INTO dictionary_identity_events(release_id,family_key,kind,details) VALUES($1,$2,$3,$4)
        ON CONFLICT(release_id,family_key,kind) DO UPDATE SET details=excluded.details`,[releaseId,family,kind,JSON.stringify(details)]);
    }
  });
}

export async function finalizeReleaseIdentities(releaseId,{client:providedClient}={}) {
  const release=(await query('SELECT * FROM dictionary_releases WHERE id=$1',[releaseId])).rows[0];
  if(!release || !['staging','validated'].includes(release.status)) throw new Error('Only a staging/validated release can reconcile identities');
  const previous=(await query('SELECT active_release_id FROM sources WHERE id=$1',[release.source_id])).rows[0]?.active_release_id ?? null;
  const client=providedClient ?? await pool.connect();
  let mapped=0,ambiguous=0;
  try {
    await client.query('BEGIN');
    // The cursor bounds Node memory. Only families present in the previous
    // release or with a known alias need work; entirely new families keep IDs.
    await client.query(`DECLARE identity_families NO SCROLL CURSOR FOR
      WITH old_families AS (
        SELECT word_atlas_source_family(e.source_key) AS family_key,jsonb_agg(s.entry_id) AS previous
        FROM source_entries s JOIN entries e ON e.id=s.entry_id WHERE s.release_id=$1 GROUP BY 1
      ), relevant AS (
        SELECT family_key FROM old_families
        UNION SELECT a.family_key FROM entry_identity_aliases a JOIN source_entries s ON s.entry_id=a.signature AND s.release_id=$2 WHERE a.source_id=$3
      )
      SELECT r.family_key,coalesce(o.previous,'[]'::jsonb) AS previous,
        jsonb_agg(jsonb_build_object('id',s.entry_id,'alias',CASE WHEN NOT a.ambiguous THEN a.entry_id END)) AS current
      FROM relevant r JOIN entries e ON word_atlas_source_family(e.source_key)=r.family_key
      JOIN source_entries s ON s.entry_id=e.id AND s.release_id=$2
      LEFT JOIN old_families o ON o.family_key=r.family_key
      LEFT JOIN entry_identity_aliases a ON a.signature=s.entry_id AND a.source_id=$3 AND a.family_key=r.family_key
      GROUP BY r.family_key,o.previous`,[previous,releaseId,release.source_id]);
    while(true) {
      const {rows}=await client.query('FETCH 100 FROM identity_families');
      if(!rows.length) break;
      for(const family of rows) {
        const plan=planFamilyMappings(family.previous,family.current);
        await applyFamily(releaseId,release.source_id,family.family_key,plan);
        mapped+=plan.mappings.length; ambiguous+=Number(plan.ambiguous.length>0);
      }
    }
    await client.query('CLOSE identity_families');
    await client.query('COMMIT');
    const totals=(await query(`SELECT coalesce(sum(jsonb_array_length(details)) FILTER (WHERE kind='mapped'),0)::int AS mapped, count(*) FILTER (WHERE kind='ambiguous')::int AS ambiguous FROM dictionary_identity_events WHERE release_id=$1`,[releaseId])).rows[0];
    mapped=totals.mapped; ambiguous=totals.ambiguous;
    await query(`UPDATE dictionary_releases SET manifest=manifest || $2::jsonb WHERE id=$1`,[releaseId,JSON.stringify({identityReconciled:true,identityReconciledAgainst:previous,identityMappings:mapped,identityAmbiguousFamilies:ambiguous})]);
    return {mapped,ambiguous,previous};
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {if(!providedClient) client.release();}
}
