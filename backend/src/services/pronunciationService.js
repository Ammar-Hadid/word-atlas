import { createHash } from 'node:crypto';
import { storedAssetState } from './audioStorage.js';

// Both accents use the same Iapetus voice the user chose; only the locale changes.
export const VOICES = { 'en-US': 'en-US-Chirp3-HD-Iapetus', 'en-GB': 'en-GB-Chirp3-HD-Iapetus' };
export const VOICE = VOICES['en-US'];
export const ACCENTS = { us: 'en-US', uk: 'en-GB' };
export const SYNTHESIS_VERSION = 'iapetus-ipa-trim-v2';
export const hash = value => createHash('sha256').update(value).digest('hex');

// Google's documented IPA inventories. Anything outside them is never sent as a
// phoneme; the word is then spoken from its spelling instead.
// https://docs.cloud.google.com/text-to-speech/docs/phonemes
const CONSONANTS = [...'pbtdkɡmnŋfvszθðʃʒhlɹʧʤjw'];
const MARKS = [...'ˈˌ. '];
const INVENTORY = {
    'en-US': ['ɑː','iː','ɔː','uː','aɪ','aʊ','eɪ','ɔɪ','oʊ','tʃ','dʒ',...'æəɚɛɪʊʌ',...CONSONANTS,...MARKS],
    'en-GB': ['ɑː','iː','ɔː','uː','ɜː','aɪ','aʊ','eɪ','ɔɪ','əʊ','eə','iə','ʊə','tʃ','dʒ',...'æəɛɪɒʊʌ',...CONSONANTS,...MARKS],
};
// Wiktionary's broad notation for the same sounds. Greedy matching of the
// inventory runs first, so diphthongs and long vowels are never split.
const ALIASES = {
    'en-US': [['ɜːɹ','ɚ'],['ɜːr','ɚ'],['ɜɹ','ɚ'],['ɜr','ɚ'],['ɑ','ɑː'],['i','iː'],['ɔ','ɔː'],['u','uː'],['ɝ','ɚ'],['r','ɹ']],
    'en-GB': [['ɜ','ɜː'],['ɑ','ɑː'],['i','iː'],['ɔ','ɔː'],['u','uː'],['r','ɹ']],
};
const UNSAFE_WITHOUT_IPA = new Set(['lead','read','wind','bow','tear','bass','close','does','minute',
    'object','present','record','refuse','resume','row','sow','wound','live','use','invalid','entrance','conduct','desert']);

export function validatePhoneme(source, { language = 'en-US' } = {}) {
    if (typeof source !== 'string' || source.length > 180) return null;
    let value = source.trim().replace(/^\/([^/]+)\/$/u, '$1').replace(/^\[([^\]]+)\]$/u, '$1');
    // Conventional alternate Unicode spellings, not accent changes.
    value = value.replaceAll('g','ɡ').replaceAll('t͡ʃ','tʃ').replaceAll('d͡ʒ','dʒ');
    if (language === 'en-GB') value = value.replaceAll('ɪə','iə').replaceAll('ɛə','eə').replaceAll('ɛː','eə');
    if (!/[^ˈˌ. ]/u.test(value)) return null;
    const tokens = INVENTORY[language], aliases = ALIASES[language];
    let remaining = value, normalized = '';
    while (remaining) {
        const token = tokens.find(item => remaining.startsWith(item));
        const alias = token ? null : aliases.find(([from]) => remaining.startsWith(from));
        if (!token && !alias) return null;
        normalized += token ?? alias[1];
        remaining = remaining.slice((token ?? alias[0]).length);
    }
    return normalized;
}

const US_LABEL = /\bUS\b|\bUSA\b|General[ -]American|\bGenAm\b|\bAmerican\b/iu;
const UK_LABEL = /\bUK\b|\bRP\b|Received[ -]Pronunciation|\bBritish\b|\bBrit\b/iu;
// Regional accents never stand in for the US or UK default. Another national accent
// only counts when the source says the same sound is also US or UK.
const REGIONAL_LABEL = /Scot|Ireland|Irish|Wales|Welsh|Cockney|Northern|Yorkshire|Northumbria|Geordie|Scouse|Estuary|West[ -]Country|Southern US|dialect/iu;
const NATIONAL_LABEL = /Australia|New[ -]Zealand|South[ -]Africa|India|Canad/iu;
const DISFAVOURED = /\brare\b|\bdated\b|\bobsolete\b|\barchaic\b|nonstandard/iu;

const labelsOf = sound => [...new Set([...(sound.tags ?? []), ...(sound.raw_tags ?? []), ...(sound.labels ?? []),
    ...(sound.note ? [sound.note] : [])])].filter(label => typeof label === 'string');

// Choose the single source IPA that best represents one accent, or null.
export function pickSound(sounds, accent) {
    const own = accent === 'us' ? US_LABEL : UK_LABEL;
    const foreign = accent === 'us' ? UK_LABEL : US_LABEL;
    let best = null, bestScore = -Infinity;
    for (const sound of sounds) {
        const text = labelsOf(sound).join(' ');
        const isOwn = own.test(text);
        if (REGIONAL_LABEL.test(text) || (!isOwn && (foreign.test(text) || NATIONAL_LABEL.test(text)))) continue;
        const score = (isOwn ? 4 : 2) + (/^\//u.test(sound.ipa) ? 1 : 0) - (DISFAVOURED.test(text) ? 3 : 0);
        if (score > bestScore) { best = sound; bestScore = score; }
    }
    return best;
}

// Exactly one US and one UK pronunciation per entry. A missing or unusable IPA
// falls back to speaking the spelling, so the Listen button always has a sound.
export function derivePronunciations(entry) {
    const text = entry.word?.normalize('NFC').trim();
    if (!entry.id || !text || text.length > 200) return [];
    const sounds = (entry.sourceSounds ?? entry.pronunciations ?? [])
        .filter(sound => typeof sound.ipa === 'string' && (!sound.form || sound.form === text));
    return Object.entries(ACCENTS).map(([accent, language]) => {
        const sound = pickSound(sounds, accent);
        const ipa = sound?.ipa ?? null;
        let phoneme = validatePhoneme(ipa, { language });
        // Reviewed monosyllabic lead variants: primary stress is redundant here.
        if (text.toLowerCase() === 'lead' && ['ˈliːd','ˈlɛd'].includes(phoneme)) phoneme = phoneme.slice(1);
        // Without a verified sound, a heteronym could be read with the wrong meaning.
        const ambiguous = !phoneme && (UNSAFE_WITHOUT_IPA.has(text.toLowerCase()) || Number(entry.homograph) > 1);
        return {
            id: hash(JSON.stringify([entry.id, language, text, ipa])),
            entryId: entry.id, accent, language, spokenText: text, sourceIpa: ipa, phoneme,
            label: accent === 'us' ? 'US' : 'UK',
            validationStatus: ambiguous ? 'ambiguous' : phoneme ? 'validated' : 'text',
            reason: ambiguous ? 'A verified pronunciation is needed for this meaning.' : null,
            sourceDetail: sound ?? {},
        };
    });
}

export function synthesisConfig(pronunciation) {
    const text = pronunciation.spoken_text ?? pronunciation.spokenText;
    const phoneme = pronunciation.phoneme ?? null;
    const language = pronunciation.language ?? 'en-US';
    if (!text || text.length > 200 || !VOICES[language]) throw new Error('invalid_pronunciation');
    // Key order is part of the asset identity; keep it stable so cached recordings are reused.
    return { text: text.normalize('NFC'), language, phoneme, provider: 'google-chirp3-hd',
        voice: VOICES[language], version: SYNTHESIS_VERSION, format: 'MP3', speakingRate: 1.0,
        processing: {policy:'leading50-pad100-reviewed-audition-v1',leadingSilenceDb:-50,paddingMs:100,encodingKbps:96} };
}

export const assetKeyFor = config => hash(JSON.stringify(config));

export async function registerEntryPronunciations(entry, database) {
    const db = database ?? await import('../db/index.js');
    const records = derivePronunciations(entry);
    for (const record of records) {
        await db.query(`INSERT INTO pronunciations
            (id,entry_id,spoken_text,language,source_ipa,phoneme,label,validation_status,reason,source_detail)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
            ON CONFLICT(id) DO UPDATE SET validation_status=EXCLUDED.validation_status,
                reason=EXCLUDED.reason,phoneme=EXCLUDED.phoneme,source_detail=EXCLUDED.source_detail`,
        [record.id,record.entryId,record.spokenText,record.language,record.sourceIpa,record.phoneme,
            record.label,record.validationStatus,record.reason,JSON.stringify(record.sourceDetail)]);
    }
    const keys = records.map(record => assetKeyFor(synthesisConfig(record)));
    const { rows: assets } = keys.length
        ? await db.query('SELECT asset_key,status,duration_seconds,error_code,byte_size FROM audio_assets WHERE asset_key=ANY($1::text[])', [keys])
        : { rows: [] };
    const byKey = new Map((await Promise.all(assets.map(storedAssetState))).map(asset => [asset.asset_key, asset]));
    return records.map((record, index) => {
        const permitted = record.validationStatus !== 'ambiguous';
        const asset = permitted ? byKey.get(keys[index]) : null;
        return { id: record.id, accent: record.accent, ipa: record.sourceIpa, label: record.label,
            status: permitted ? (asset?.status ?? 'unprepared') : 'unavailable',
            reason: record.reason ?? asset?.error_code ?? null,
            ...(asset?.status === 'ready' ? { assetKey: asset.asset_key, url: `/audio/${asset.asset_key}.mp3`, duration: asset.duration_seconds } : {}),
        };
    });
}
export const ensureEntryPronunciations = registerEntryPronunciations;
