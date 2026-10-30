import { createHash } from 'node:crypto';
import { query, transaction } from '../db/index.js';
import { normalizeKey, validTerm } from '../import/normalizeKaikki.js';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function personalItem(input, type = 'history') {
    if (!input || !validTerm(input.word)) throw Object.assign(new Error('Each record needs a word of 1–200 characters.'),{status:400});
    const timestamp = input[type === 'saved' ? 'savedAt' : 'visitedAt'];
    if (timestamp == null) throw Object.assign(new Error('A record timestamp is required for safe retries.'),{status:400});
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime()) || date.getTime() < 0 || date.getTime() > Date.now()+300000) throw Object.assign(new Error('Invalid record timestamp.'),{status:400});
    if (input.entryId != null && (typeof input.entryId !== 'string' || !/^[a-f0-9]{64}$/.test(input.entryId))) throw Object.assign(new Error('Invalid entry reference.'),{status:400});
    return { word: input.word.trim(), key: normalizeKey(input.word), at: date.toISOString(), ...(input.entryId ? {entryId:input.entryId} : {}) };
}
async function resolveEntry(client,item) {
    if(item.entryId) {
        const {rows}=await client.query(`SELECT e.id FROM entries e WHERE e.id=$1 AND
            (e.lookup_key=$2 OR EXISTS(SELECT 1 FROM forms f JOIN sources s ON s.active_release_id=f.release_id WHERE f.entry_id=e.id AND f.lookup_key=$2))`,[item.entryId,item.key]);
        if(!rows.length) throw Object.assign(new Error('Entry does not match this word.'),{status:400});
        return rows[0].id;
    }
    let {rows}=await client.query(`SELECT e.id FROM entries e JOIN source_entries se ON se.entry_id=e.id
        JOIN sources s ON s.active_release_id=se.release_id WHERE e.lookup_key=$1 ORDER BY e.id LIMIT 2`,[item.key]);
    if(!rows.length) ({rows}=await client.query(`SELECT DISTINCT f.entry_id AS id FROM forms f
        JOIN sources s ON s.active_release_id=f.release_id WHERE f.lookup_key=$1 LIMIT 2`,[item.key]));
    return rows.length === 1 ? rows[0].id : null;
}
export async function once(client,userId,operationId,payload,work) {
    if(typeof operationId!=='string'||!/^[-a-zA-Z0-9:._]{8,180}$/.test(operationId)) throw Object.assign(new Error('A valid idempotency key is required.'),{status:400});
    const hash=digest(payload);
    const {rows}=await client.query('INSERT INTO personal_operations(user_id,operation_id,payload_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING operation_id',[userId,operationId,hash]);
    if(!rows.length) {
        const prior=await client.query('SELECT payload_hash FROM personal_operations WHERE user_id=$1 AND operation_id=$2',[userId,operationId]);
        if(prior.rows[0].payload_hash!==hash) throw Object.assign(new Error('Idempotency key was used with different content.'),{status:409});
        return false;
    }
    await work(); return true;
}
async function put(client,userId,item,type) {
    const entryId=await resolveEntry(client,item);
    if(type==='saved') await client.query(`INSERT INTO saved_entries(user_id,term_key,display_term,entry_id,saved_at)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,term_key) DO UPDATE SET
        entry_id=COALESCE(saved_entries.entry_id,EXCLUDED.entry_id),saved_at=LEAST(saved_entries.saved_at,EXCLUDED.saved_at)`,[userId,item.key,item.word,entryId,item.at]);
    else await client.query(`INSERT INTO search_history(user_id,term_key,display_term,entry_id,first_visited_at,last_visited_at)
        VALUES($1,$2,$3,$4,$5,$5) ON CONFLICT(user_id,term_key) DO UPDATE SET
        entry_id=COALESCE(search_history.entry_id,EXCLUDED.entry_id),
        first_visited_at=LEAST(search_history.first_visited_at,EXCLUDED.first_visited_at),
        last_visited_at=GREATEST(search_history.last_visited_at,EXCLUDED.last_visited_at),visit_count=search_history.visit_count+1`,[userId,item.key,item.word,entryId,item.at]);
}
export async function saveItem(userId,input,type,operationId) {
    const item=personalItem(input,type);
    // Timestamp is part of a history event; caller supplies one for safe retries.
    return transaction(client=>once(client,userId,operationId,{type,...item},()=>put(client,userId,item,type)));
}
export async function importItems(userId,input) {
    if(!input||!Array.isArray(input.saved)||!Array.isArray(input.history)||input.saved.length+input.history.length>1000) throw Object.assign(new Error('Import up to 1,000 records per batch.'),{status:400});
    const items=['saved','history'].flatMap(type=>input[type].map(raw=>({type,item:personalItem(raw,type)})));
    return transaction(async client=>{
        let imported=0;
        for(const {type,item} of items) {
            const operation=`import:${type}:${digest(item)}`;
            if(await once(client,userId,operation,{type,...item},()=>put(client,userId,item,type))) imported++;
        }
        return { received:items.length, imported, alreadyImported:items.length-imported, verified:true };
    });
}
export async function listItems(userId,type,{offset=0,limit=100}={}) {
    const table=type==='saved'?'saved_entries':'search_history';
    const date=type==='saved'?'saved_at':'last_visited_at';
    const result=await query(`SELECT p.*,e.part_of_speech,se.payload->'shortDefinitions'->>0 AS definition,
        se.payload->>'phonetic' AS phonetic FROM ${table} p
        LEFT JOIN entries e ON e.id=p.entry_id
        LEFT JOIN sources s ON s.id='wiktionary-en'
        LEFT JOIN source_entries se ON se.entry_id=p.entry_id AND se.release_id=s.active_release_id
        WHERE p.user_id=$1 ORDER BY p.${date} DESC,p.term_key LIMIT $2 OFFSET $3`,[userId,limit,offset]);
    const count=await query(`SELECT count(*)::integer AS total FROM ${table} WHERE user_id=$1`,[userId]);
    const items=result.rows.map(row=>({word:row.display_term,entryId:row.entry_id,partOfSpeech:row.part_of_speech,definition:row.definition,phonetic:row.phonetic,
        ...(type==='saved'?{savedAt:new Date(row.saved_at).getTime()}:{visitedAt:new Date(row.last_visited_at).getTime(),firstVisitedAt:new Date(row.first_visited_at).getTime(),visitCount:Number(row.visit_count)})}));
    return {items,total:count.rows[0].total,nextOffset:offset+items.length<count.rows[0].total?offset+items.length:null};
}
export async function removeItem(userId,term,operationId) {
    if(!validTerm(term)) throw Object.assign(new Error('Invalid word.'),{status:400});
    const key=normalizeKey(term);
    return transaction(client=>once(client,userId,operationId,{type:'remove',key},()=>client.query('DELETE FROM saved_entries WHERE user_id=$1 AND term_key=$2',[userId,key])));
}
export async function clearHistory(userId,operationId) {
    return transaction(client=>once(client,userId,operationId,{type:'clear'},()=>client.query('DELETE FROM search_history WHERE user_id=$1',[userId])));
}
export async function getSavedItem(userId,term) {
    if(!validTerm(term)) throw Object.assign(new Error('Invalid word.'),{status:400});
    const {rows}=await query('SELECT display_term,entry_id,saved_at FROM saved_entries WHERE user_id=$1 AND term_key=$2',[userId,normalizeKey(term)]);
    return rows[0]?{word:rows[0].display_term,entryId:rows[0].entry_id,savedAt:new Date(rows[0].saved_at).getTime()}:null;
}
