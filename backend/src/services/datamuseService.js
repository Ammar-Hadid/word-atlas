import { transaction } from '../db/index.js';
import { validTerm } from '../import/normalizeKaikki.js';

// The official page currently gives conflicting January/February 2027 dates.
// Use the earlier free-access deadline; renewal requires recorded verification.
// https://www.datamuse.com/api/ (reviewed 2026-10-30)
export const INITIAL_FREE_UNTIL = '2027-01-01T00:00:00Z';
const CALLS_PER_LOOKUP = 6;
const empty = availability => ({ synonyms: [], antonyms: [], similar: [], associated: [], rhymes: [], frequency: null, syllableCount: null, availability });

export function freeAccessVerified({ now = Date.now(), until = process.env.DATAMUSE_FREE_UNTIL ?? INITIAL_FREE_UNTIL,
    evidence = process.env.DATAMUSE_FREE_VERIFICATION ?? '', disabled = process.env.DATAMUSE_DISABLED === 'true' } = {}) {
    const deadline = Date.parse(until);
    if (disabled || !Number.isFinite(deadline) || now >= deadline) return false;
    return deadline <= Date.parse(INITIAL_FREE_UNTIL) || evidence.trim().length >= 20;
}

export async function reserveDatamuse(count = CALLS_PER_LOOKUP, {
    transact = transaction, dailyLimit = Number(process.env.DATAMUSE_DAILY_LIMIT ?? 10000), freeAccess = freeAccessVerified,
} = {}) {
    if (!Number.isSafeInteger(count) || count < 1 || count > CALLS_PER_LOOKUP || !Number.isSafeInteger(dailyLimit) || dailyLimit < count || !freeAccess()) return false;
    const cap = Math.min(dailyLimit, 10000);
    return transact(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['datamuse:quota']);
        if (!freeAccess()) return false;
        const { rows } = await client.query("SELECT count(*)::integer AS used FROM editorial_usage WHERE reference='datamuse' AND used_at>now()-interval '24 hours'");
        if (rows[0].used + count > cap) return false;
        // Keep reservations even if a response times out: the provider may have
        // already received each request. No response content is stored here.
        await client.query("INSERT INTO editorial_usage(reference) SELECT 'datamuse' FROM generate_series(1,$1)", [count]);
        return true;
    });
}

const toWords = (results, exclude) => {
    const seen = new Set(exclude.map(word => word.toLowerCase()));
    return results.filter(item => item && typeof item.word === 'string' && !item.tags?.includes?.('prop'))
        .map(item => item.word).filter(word => {
            const key = word.toLowerCase();
            if (!/^[a-z][a-z'-]*$/i.test(word) || seen.has(key)) return false;
            seen.add(key); return true;
        });
};
function normalize(term, responses) {
    const [synonyms, antonyms, similar, associated, rhymes, metadata] = responses.map(result => result.items);
    const synonymWords = toWords(synonyms, [term]), antonymWords = toWords(antonyms, [term]);
    const similarWords = toWords(similar, [term, ...synonymWords, ...antonymWords]);
    const associatedWords = toWords(associated, [term, ...synonymWords, ...similarWords]);
    const meta = metadata[0];
    const exact = typeof meta?.word === 'string' && meta.word.toLowerCase() === term;
    const frequencyTag = Array.isArray(meta?.tags) ? meta.tags.find(tag => typeof tag === 'string' && tag.startsWith('f:')) : null;
    const frequency = frequencyTag ? Number(frequencyTag.slice(2)) : null;
    const successes = responses.filter(result => result.ok).length;
    return { synonyms: synonymWords, antonyms: antonymWords, similar: similarWords, associated: associatedWords,
        rhymes: toWords(rhymes, [term]).slice(0, 16),
        frequency: exact && Number.isFinite(frequency) && frequency >= 0 ? frequency : null,
        syllableCount: exact && Number.isInteger(meta.numSyllables) && meta.numSyllables > 0 ? meta.numSyllables : null,
        availability: successes === CALLS_PER_LOOKUP ? 'available' : successes ? 'partial' : 'unavailable' };
}

export function createDatamuseService({ fetchImpl = fetch, reserve = reserveDatamuse, freeAccess = freeAccessVerified,
    now = Date.now, timeoutMs = 1500, ttlMs = 300000, maxEntries = 256 } = {}) {
    const cache = new Map(), pending = new Map();
    const request = async params => {
        const controller = new AbortController();
        let timer;
        try {
            const items = await Promise.race([
                Promise.resolve().then(async () => {
                    const response = await fetchImpl(`https://api.datamuse.com/words?${new URLSearchParams(params)}`, { signal: controller.signal });
                    if (!response.ok) throw new Error('Insights provider unavailable');
                    const data = await response.json();
                    if (!Array.isArray(data)) throw new Error('Invalid insights response');
                    return data.slice(0, 40);
                }),
                new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Insights deadline')); }, Math.min(timeoutMs, 1500)); }),
            ]);
            return { ok: true, items };
        } catch { return { ok: false, items: [] }; }
        finally { clearTimeout(timer); }
    };
    return async function getInsights(word) {
        if (!validTerm(word)) throw Object.assign(new Error('Enter a term of 1–200 characters.'), { status: 400 });
        const term = word.normalize('NFC').trim().toLowerCase();
        const cached = cache.get(term);
        if (cached && cached.until > now()) return cached.value;
        cache.delete(term);
        if (pending.has(term)) return pending.get(term);
        if (pending.size >= 8) return empty('unavailable');
        const work = async () => {
            if (!freeAccess()) return empty('allowance_exhausted');
            try { if (!await reserve(CALLS_PER_LOOKUP)) return empty('allowance_exhausted'); }
            catch { return empty('unavailable'); }
            if (!freeAccess()) return empty('allowance_exhausted');
            const responses = await Promise.all([
                request({ rel_syn: term, max: 30, md: 'p' }), request({ rel_ant: term, max: 16 }),
                request({ ml: term, max: 40, md: 'p' }), request({ rel_trg: term, max: 30, md: 'p' }),
                request({ rel_rhy: term, max: 24 }), request({ sp: term, md: 'fs', max: 1 }),
            ]);
            const value = normalize(term, responses);
            // Store normalized insight lists only, with bounded lifetime/size.
            if (cache.size >= Math.min(maxEntries, 256)) cache.delete(cache.keys().next().value);
            cache.set(term, { value, until: now() + Math.min(ttlMs, 300000) });
            return value;
        };
        const promise = work().finally(() => pending.delete(term));
        pending.set(term, promise);
        return promise;
    };
}

export const getInsights = createDatamuseService();
