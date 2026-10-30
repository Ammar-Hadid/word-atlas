import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePronunciations, validatePhoneme, synthesisConfig, assetKeyFor, VOICES } from '../src/services/pronunciationService.js';
import { billableUpperBound, allowanceStatus, limits } from '../src/services/providerBudget.js';
import { googleRequest, synthesizeGoogle } from '../src/services/googleSpeech.js';

const entry = (sounds, word = 'lead', id = 'stable-entry') => ({ id, word, partOfSpeech: 'noun', sourceSounds: sounds,
    senses: [{ senses: [{ id: 'sense-1', definition: 'Synthetic definition.' }] }] });
const byAccent = records => Object.fromEntries(records.map(record => [record.accent, record]));

test('every entry gets exactly one US and one UK pronunciation', () => {
    const records = derivePronunciations(entry([{ ipa: '/təˈmɑː.təʊ/', tags: ['Received-Pronunciation'] },
        { ipa: '/təˈmeɪ.toʊ/', tags: ['US'] }, { ipa: '[tʰəˈmeɪ̯ɾo]', tags: ['Canada'] }], 'tomato'));
    assert.deepEqual(records.map(record => [record.accent, record.language]), [['us', 'en-US'], ['uk', 'en-GB']]);
    const { us, uk } = byAccent(records);
    assert.equal(us.sourceIpa, '/təˈmeɪ.toʊ/');
    assert.equal(us.phoneme, 'təˈmeɪ.toʊ');
    assert.equal(uk.sourceIpa, '/təˈmɑː.təʊ/');
    assert.equal(uk.phoneme, 'təˈmɑː.təʊ');
});

test('regional and other national accents never become the US or UK default', () => {
    const { us, uk } = byAccent(derivePronunciations(entry([
        { ipa: '/ˈwɔː.ʔə/', tags: ['Cockney', 'UK'] }, { ipa: '/ˈwa.tə/', tags: ['Northern-England', 'UK'] },
        { ipa: '/ˈwɔː.tə/', tags: ['Received-Pronunciation', 'UK'] }, { ipa: '/ˈwɔ.tɚ/', tags: ['General-American'] },
    ], 'water')));
    assert.equal(uk.sourceIpa, '/ˈwɔː.tə/');
    assert.equal(us.sourceIpa, '/ˈwɔ.tɚ/');
    const australian = byAccent(derivePronunciations(entry([{ ipa: '/ˈwoːtə/', tags: ['Australia'] }], 'water')));
    assert.equal(australian.us.sourceIpa, null);
    assert.equal(australian.uk.sourceIpa, null);
});

test('an unusable or missing IPA falls back to speaking the spelling', () => {
    const { us, uk } = byAccent(derivePronunciations(entry([{ ipa: '/ɬə/' }], 'cat')));
    assert.equal(us.validationStatus, 'text');
    assert.equal(us.phoneme, null);
    assert.equal(uk.validationStatus, 'text');
    assert.equal(byAccent(derivePronunciations({ id: 'cat', word: 'cat', senses: [] })).us.validationStatus, 'text');
});

test('heteronyms without a verified sound are withheld rather than misread', () => {
    assert.equal(byAccent(derivePronunciations({ id: 'lead', word: 'lead', senses: [] })).us.validationStatus, 'ambiguous');
    assert.equal(byAccent(derivePronunciations({ id: 'x', word: 'bass', homograph: 2, senses: [] })).uk.validationStatus, 'ambiguous');
});

test('lead sound identity comes from source pronunciation; the same sound shares one recording', () => {
    const guide = byAccent(derivePronunciations(entry([{ ipa: '/ˈliːd/' }]))).us;
    const metal = byAccent(derivePronunciations(entry([{ ipa: '/lɛd/' }]))).us;
    assert.equal(guide.phoneme, 'liːd');
    assert.notEqual(assetKeyFor(synthesisConfig(guide)), assetKeyFor(synthesisConfig(metal)));
    const again = byAccent(derivePronunciations(entry([{ ipa: '/ˈliːd/' }], 'lead', 'another-entry'))).us;
    assert.notEqual(guide.id, again.id);
    assert.equal(assetKeyFor(synthesisConfig(guide)), assetKeyFor(synthesisConfig(again)));
});

test('source inflected pronunciations are not applied to the headword', () => {
    const { us } = byAccent(derivePronunciations(entry([{ ipa: '/lɛd/', form: 'led' }, { ipa: '/liːd/' }])));
    assert.equal(us.sourceIpa, '/liːd/');
});

test('IPA is checked against each locale inventory', () => {
    assert.equal(validatePhoneme('/kæt/'), 'kæt');
    assert.equal(validatePhoneme('/kʰæt/'), null);
    assert.equal(validatePhoneme('<speak>'), null);
    assert.equal(validatePhoneme('/ˈ/'), null);
    assert.equal(validatePhoneme('/ˈɑ i ɔ u ɝ r ɔɪ oʊ aɪ aʊ eɪ iː/'), 'ˈɑː iː ɔː uː ɚ ɹ ɔɪ oʊ aɪ aʊ eɪ iː');
    assert.equal(validatePhoneme('/wɜːɹd/'), 'wɚd');
    assert.equal(validatePhoneme('/ɡɒt/'), null);
    assert.equal(validatePhoneme('/ɡɒt/', { language: 'en-GB' }), 'ɡɒt');
    assert.equal(validatePhoneme('/ˈhɪə/', { language: 'en-GB' }), 'ˈhiə');
    assert.equal(validatePhoneme('/wɜːd/', { language: 'en-GB' }), 'wɜːd');
    assert.equal(validatePhoneme('/ɡoʊ/', { language: 'en-GB' }), null);
});

test('only the approved Iapetus voices, rate and format can reach the provider', () => {
    const { us, uk } = byAccent(derivePronunciations(entry([{ ipa: '/lɛd/' }])));
    const usRequest = googleRequest(synthesisConfig(us));
    assert.equal(usRequest.voice.name, VOICES['en-US']);
    assert.equal(usRequest.voice.languageCode, 'en-US');
    assert.equal(usRequest.input.customPronunciations.pronunciations[0].pronunciation, 'lɛd');
    const ukRequest = googleRequest(synthesisConfig(uk));
    assert.equal(ukRequest.voice.name, 'en-GB-Chirp3-HD-Iapetus');
    const config = synthesisConfig(us);
    assert.throws(() => googleRequest({ ...config, voice: 'en-US-Neural2-J' }));
    assert.throws(() => googleRequest({ ...config, voice: VOICES['en-GB'] }));
    assert.throws(() => googleRequest({ ...config, speakingRate: 1.2 }));
    assert.ok(billableUpperBound(config) >= config.text.length * 2 + config.phoneme.length);
});

test('US asset identity is unchanged, so existing recordings are reused', () => {
    const { us } = byAccent(derivePronunciations(entry([{ ipa: '/lɛd/' }])));
    assert.deepEqual(Object.keys(synthesisConfig(us)),
        ['text','language','phoneme','provider','voice','version','format','speakingRate','processing']);
});

test('visitors stop before the owner, and nobody can pass 90% of the free tier', async () => {
    const saved = Object.fromEntries(['AUDIO_MONTHLY_CHARACTER_LIMIT','AUDIO_VISITOR_MONTHLY_LIMIT','AUDIO_VISITOR_DAILY_LIMIT']
        .map(name => [name, process.env[name]]));
    try {
        for (const name of Object.keys(saved)) delete process.env[name];
        assert.deepEqual(limits(), { monthly: 800000, visitorMonthly: 600000, visitorDaily: 20000 });
        process.env.AUDIO_MONTHLY_CHARACTER_LIMIT = '5000000';
        assert.equal(limits().monthly, 900000);
        Object.assign(process.env, { AUDIO_MONTHLY_CHARACTER_LIMIT: '100', AUDIO_VISITOR_MONTHLY_LIMIT: '70', AUDIO_VISITOR_DAILY_LIMIT: '30' });
        const db = (month, visitorMonth, visitorDay) => ({ query: async () => ({ rows: [{ month, visitor_month: visitorMonth, visitor_day: visitorDay }] }) });
        const visitor = { audience: 'visitor' };
        assert.equal((await allowanceStatus(db(90, 0, 0), 10)).status, 'permitted');
        assert.equal((await allowanceStatus(db(91, 0, 0), 10)).status, 'allowance_exhausted');
        assert.equal((await allowanceStatus(db(20, 20, 20), 10, visitor)).status, 'permitted');
        assert.equal((await allowanceStatus(db(20, 20, 21), 10, visitor)).status, 'allowance_exhausted'); // daily share
        assert.equal((await allowanceStatus(db(61, 61, 0), 10, visitor)).status, 'allowance_exhausted'); // visitor month share
        assert.equal((await allowanceStatus(db(61, 61, 0), 10)).status, 'permitted'); // owner reserve
    } finally {
        for (const [name, value] of Object.entries(saved)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
});

test('provider failures and timeouts make one attempt, without automatic fallback or retry', async () => {
    let calls = 0;
    const config = synthesisConfig(byAccent(derivePronunciations(entry([{ ipa: '/lɛd/' }]))).us);
    await assert.rejects(synthesizeGoogle(config, 'test-token', async () => { calls++; throw new Error('timeout'); }), /timeout/);
    assert.equal(calls, 1);
    await assert.rejects(synthesizeGoogle(config, 'test-token', async () => ({ ok: false, status: 429 })), /provider_http_429/);
    await assert.rejects(synthesizeGoogle(config, 'test-token', async () => ({ ok: true, json: async () => ({ audioContent: '<html>error' }) })), /invalid_provider_audio/);
});
