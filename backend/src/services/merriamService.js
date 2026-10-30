import { transaction } from '../db/index.js';
const BASE_URL='https://www.dictionaryapi.com/api/v3/references';
const DICTIONARIES={learners:'MERRIAM_WEBSTER_LEARNERS',collegiate:'MERRIAM_WEBSTER_DICTIONARY'};

export async function reserveEditorial(reference) {
    if(process.env.MW_ENABLE_AFTER && Date.now()<Date.parse(process.env.MW_ENABLE_AFTER)) return false;
    return transaction(async client=>{
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`mw:${reference}`]);
        const {rows}=await client.query("SELECT count(*)::integer AS used FROM editorial_usage WHERE reference=$1 AND used_at>now()-interval '24 hours'",[reference]);
        // Rolling day is conservative across provider timezone/day boundaries.
        if(rows[0].used>=Math.min(Number(process.env.MW_DAILY_LIMIT||900),1000)) return false;
        await client.query('INSERT INTO editorial_usage(reference) VALUES($1)',[reference]);
        return true;
    });
}
export async function fetchFromDictionary(dictionary,term) {
    const key=process.env[DICTIONARIES[dictionary]];
    if(!key) throw Object.assign(new Error('Editorial source is not configured.'),{code:'not_configured'});
    if(!await reserveEditorial(dictionary)) throw Object.assign(new Error('Editorial allowance unavailable.'),{code:'allowance_exhausted'});
    const response=await fetch(`${BASE_URL}/${dictionary}/json/${encodeURIComponent(term)}?key=${encodeURIComponent(key)}`,{signal:AbortSignal.timeout(1600)});
    if(!response.ok) throw Object.assign(new Error('Editorial provider unavailable.'),{code:'provider_unavailable'});
    const data=await response.json();
    if(!Array.isArray(data)) throw new Error('Unexpected editorial response.');
    return data; // No durable or cross-request proprietary-content cache.
}
export default function fetchWord(term){ return fetchFromDictionary('learners',term); }
export const fetchCollegiateWord=term=>fetchFromDictionary('collegiate',term);
