import { createHash } from 'node:crypto';
import { storedAssetState } from './audioStorage.js';

export const VOICE = 'en-US-Chirp3-HD-Iapetus';
export const SYNTHESIS_VERSION = 'iapetus-ipa-trim-v2';
export const hash = value => createHash('sha256').update(value).digest('hex');

// The documented en-US inventory; unsupported diacritics are NOT silently discarded.
// https://docs.cloud.google.com/text-to-speech/docs/phonemes#english_united_states_en-us
const TOKENS = ['ɑː','iː','ɔː','uː','aɪ','aʊ','eɪ','ɔɪ','oʊ','tʃ','dʒ',
    ...'pbtdkɡmnŋfvszθðʃʒhlɹʧʤjwæəɚɛɪʊʌˈˌ. '];
const UNSAFE_WITHOUT_IPA = new Set(['lead','read','wind','bow','tear','bass','close','does','minute',
    'object','present','record','refuse','resume','row','sow','wound','live','use','invalid','entrance','conduct','desert']);

// Conventional broad-US notation aliases, only enabled for an explicitly US source.
// Greedy matching of the documented inventory precedes aliases, so ɔɪ/oʊ/aɪ
// remain diphthongs and already-long vowels never gain a second length mark.
const US_NOTATION = [['ɜːɹ','ɚ'],['ɜːr','ɚ'],['ɜɹ','ɚ'],['ɜr','ɚ'],
    ['ɑ','ɑː'],['i','iː'],['ɔ','ɔː'],['u','uː'],['ɝ','ɚ'],['r','ɹ']];

export function validatePhoneme(source, { explicitlyUS = false } = {}) {
    if (typeof source !== 'string' || source.length > 180) return null;
    let value = source.trim().replace(/^\/([^/]+)\/$/u, '$1').replace(/^\[([^\]]+)\]$/u, '$1');
    // These are conventional alternate Unicode spellings, not accent transformations.
    value = value.replaceAll('g','ɡ').replaceAll('t͡ʃ','tʃ').replaceAll('d͡ʒ','dʒ');
    if (!value || !/[pbtdkɡmnŋfvszθðʃʒhlɹʧʤjwæəɚɛɪʊʌɑɔiuɝrɜ]/u.test(value)) return null;
    let remaining = value, normalized = '';
    while (remaining) {
        const token = TOKENS.find(item => remaining.startsWith(item));
        const alias = explicitlyUS && !token ? US_NOTATION.find(([source]) => remaining.startsWith(source)) : null;
        if (!token && !alias) return null;
        normalized += token ?? alias[1];
        remaining = remaining.slice((token ?? alias[0]).length);
    }
    return normalized;
}

function entrySenses(entry) {
    return (entry.senses ?? []).flatMap(group => group.senses ?? []);
}

export function derivePronunciations(entry) {
    const text = entry.word?.normalize('NFC').trim();
    if (!entry.id || !text || text.length > 200) return [];
    const senses = entrySenses(entry);
    const sounds = entry.sourceSounds ?? entry.pronunciations ?? [];
    const usable = sounds.filter(sound => typeof sound.ipa === 'string' && (!sound.form || sound.form === text));
    const variants = usable.length ? usable : [{ ipa: null }];
    const records = new Map();
    for (const sound of variants) {
        const ipa = sound.ipa ?? null;
        const labels = [...new Set([...(sound.tags ?? []), ...(sound.raw_tags ?? []), ...(sound.labels ?? []), ...(sound.note ? [sound.note] : [])])];
        const accentText=labels.join(' ');
        const explicitlyUS=/(?:\bUS\b|\bUSA\b|General[ -]American|\bAmerican\b)/iu.test(accentText);
        const anotherAccent=/(?:\bUK\b|\bRP\b|Received[ -]Pronunciation|Brit(?:ish|ain)|England|Scot(?:land|tish)|Ireland|Irish|Welsh|Wales|Australia|New[ -]Zealand|South[ -]Africa|India|Canada|Canadian)/iu.test(accentText);
        const clearlyOtherAccent=anotherAccent&&!explicitlyUS;
        let phoneme = validatePhoneme(ipa, {explicitlyUS});
        // Reviewed monosyllabic lead variants: primary stress is redundant here. Keep original IPA.
        if(text.toLowerCase()==='lead'&&['ˈliːd','ˈlɛd'].includes(phoneme))phoneme=phoneme.slice(1);
        const senseLabel = sound.sense ?? sound.sourceSense;
        const matches = senseLabel ? senses.filter(sense =>
            (sense.glosses ?? [sense.definition]).some(gloss => gloss === senseLabel)) : senses;
        let validation = phoneme && !clearlyOtherAccent ? 'validated' : ipa ? 'unsupported' : 'text';
        let reason = validation === 'unsupported' ? 'This source pronunciation is not validated for US English synthesis.' : null;
        if ((senseLabel && !matches.length) || (!ipa && (UNSAFE_WITHOUT_IPA.has(text.toLowerCase()) || Number(entry.homograph)>1))) {
            validation = 'ambiguous';
            reason = 'A verified pronunciation is needed for this meaning.';
        }
        // Source variants are choices. Never infer metal/guide from the part of speech.
        const id = hash(JSON.stringify([entry.id,text,ipa,labels,senseLabel ?? null]));
        records.set(id, {
            id, entryId: entry.id, spokenText: text, sourceIpa: ipa, phoneme,
            label: [ipa, ...labels].filter(Boolean).join(' · ') || 'US English',
            validationStatus: validation, reason, senseIds: matches.map(sense => sense.id).filter(Boolean),
            sourceDetail: {...sound, wordAtlasNormalization: explicitlyUS ? 'us-ipa-notation-v1' : 'documented-inventory-only'},
        });
    }
    return [...records.values()];
}

export function synthesisConfig(pronunciation) {
    const text = pronunciation.spoken_text ?? pronunciation.spokenText;
    const phoneme = pronunciation.phoneme ?? null;
    if (!text || text.length > 200) throw new Error('invalid_pronunciation');
    return { text: text.normalize('NFC'), language: 'en-US', phoneme, provider: 'google-chirp3-hd',
        voice: VOICE, version: SYNTHESIS_VERSION, format: 'MP3', speakingRate: 1.0,
        processing: {policy:'leading50-pad100-reviewed-audition-v1',leadingSilenceDb:-50,paddingMs:100,encodingKbps:96} };
}

export const assetKeyFor = config => hash(JSON.stringify(config));

export async function registerEntryPronunciations(entry, database) {
    const db = database ?? await import('../db/index.js');
    const records = derivePronunciations(entry);
    for (const record of records) {
        await db.query(`INSERT INTO pronunciations
            (id,entry_id,spoken_text,source_ipa,phoneme,label,validation_status,reason,sense_ids,source_detail)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
            ON CONFLICT(id) DO UPDATE SET sense_ids=EXCLUDED.sense_ids,validation_status=EXCLUDED.validation_status,
                reason=EXCLUDED.reason,phoneme=EXCLUDED.phoneme,source_detail=EXCLUDED.source_detail`, [record.id,record.entryId,record.spokenText,record.sourceIpa,record.phoneme,
            record.label,record.validationStatus,record.reason,JSON.stringify(record.senseIds),JSON.stringify(record.sourceDetail)]);
    }
    const keys=records.map(record=>assetKeyFor(synthesisConfig(record)));
    const {rows:assets}=keys.length?await db.query('SELECT asset_key,status,duration_seconds,error_code,byte_size FROM audio_assets WHERE asset_key=ANY($1::text[])',[keys]):{rows:[]};
    const checkedAssets=await Promise.all(assets.map(storedAssetState));
    const byKey=new Map(checkedAssets.map(asset=>[asset.asset_key,asset]));
    return records.map((record,index) => {
        const permitted=['validated','text'].includes(record.validationStatus);
        const asset=permitted?byKey.get(keys[index]):null;
        return { id: record.id, ipa: record.sourceIpa, label: record.label,
            senseIds: record.senseIds, ...(permitted?{assetKey:keys[index]}:{}), status: permitted ? (asset?.status ?? 'unprepared') : 'unavailable',
            reason: record.reason ?? asset?.error_code,
            ...(asset?.status==='ready'?{assetKey:asset.asset_key,url:`/audio/${asset.asset_key}.mp3`,duration:asset.duration_seconds}:{}),
        };
    });
}
export const ensureEntryPronunciations = registerEntryPronunciations;
