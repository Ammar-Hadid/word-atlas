import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePronunciations, validatePhoneme, synthesisConfig, assetKeyFor, VOICE } from '../src/services/pronunciationService.js';
import { billableUpperBound, allowanceStatus } from '../src/services/providerBudget.js';
import { googleRequest, synthesizeGoogle } from '../src/services/googleSpeech.js';

const entry = (ipa,word = 'lead',id = 'stable-entry') => ({id,word,partOfSpeech:'noun',sourceSounds:[{ipa}],
    senses:[{senses:[{id:'sense-1',definition:'Synthetic definition.'}]}]});

test('lead sound identity comes from source pronunciation, not noun vs verb guesses',() => {
    const guide = derivePronunciations(entry('/liːd/'))[0];
    const metal = derivePronunciations(entry('/lɛd/'))[0];
    assert.equal(guide.validationStatus,'validated');
    assert.equal(metal.validationStatus,'validated');
    assert.notEqual(guide.id,metal.id);
    assert.notEqual(assetKeyFor(synthesisConfig(guide)),assetKeyFor(synthesisConfig(metal)));
    assert.deepEqual(guide.senseIds,['sense-1']);
});

test('same sound shares recording across senses and corpus releases',() => {
    const a = derivePronunciations(entry('/liːd/','lead','entry-a'))[0];
    const b = derivePronunciations({...entry('/liːd/','lead','entry-b'),release:'new'})[0];
    assert.notEqual(a.id,b.id);
    assert.equal(assetKeyFor(synthesisConfig(a)),assetKeyFor(synthesisConfig(b)));
});

test('source variants and unsupported phones remain visible without unsafe synthesis',() => {
    const variants = derivePronunciations({...entry('/liːd/'),sourceSounds:[{ipa:'/liːd/'},{ipa:'/lɛd/'},{ipa:'/ɬə/'},{ipa:'/liːd/',tags:['UK']}]});
    assert.equal(variants.length,4);
    assert.deepEqual(variants.map(p => p.validationStatus),['validated','validated','unsupported','unsupported']);
    assert.equal(validatePhoneme('/liːd/'),'liːd');
    assert.equal(validatePhoneme('/kʰæt/'),null);
    assert.equal(validatePhoneme('<speak>'),null);
    assert.equal(validatePhoneme('/ˈ/'),null);
});

test('unresolved heteronym/sense associations are withheld; absent IPA does not imply a sense',() => {
    assert.equal(derivePronunciations({id:'lead',word:'lead',senses:[]})[0].validationStatus,'ambiguous');
    assert.equal(derivePronunciations({...entry('/liːd/'),sourceSounds:[{ipa:'/liːd/',sense:'not in entry'}]})[0].validationStatus,'ambiguous');
    assert.equal(derivePronunciations({id:'cat',word:'cat',senses:[]})[0].validationStatus,'text');
});

test('source inflected pronunciations are not applied to headword',() => {
    const records = derivePronunciations({...entry('/liːd/'),sourceSounds:[{ipa:'/liːd/'},{ipa:'/lɛd/',form:'led'}]});
    assert.equal(records.length,1);
});

test('only approved Iapetus rate/format can reach provider',() => {
    const config = synthesisConfig(derivePronunciations(entry('/lɛd/'))[0]);
    const request = googleRequest(config);
    assert.equal(request.voice.name,VOICE);
    assert.equal(request.audioConfig.speakingRate,1);
    assert.equal(request.input.customPronunciations.pronunciations[0].pronunciation,'lɛd');
    assert.throws(() => googleRequest({...config,voice:'en-US-Neural2-J'}));
    assert.throws(() => googleRequest({...config,speakingRate:1.2}));
    assert.ok(billableUpperBound(config) >= Buffer.byteLength(JSON.stringify(request)));
});

test('missing, overlapping, expired and exhausted allowances fail closed',async () => {
    const db = rows => ({query:async()=>({rows})});
    assert.equal((await allowanceStatus(db([]))).reason,'allowance_unverified');
    assert.equal((await allowanceStatus(db([{},{ }]))).reason,'allowance_unverified');
    assert.equal((await allowanceStatus(db([{character_limit:100,reserved_characters:100}]))).status,'allowance_exhausted');
    assert.equal((await allowanceStatus(db([{character_limit:100,reserved_characters:99}]),2)).status,'allowance_exhausted');
});

test('provider failures and timeouts make one attempt, without automatic fallback or retry',async () => {
    let calls=0;
    const config = synthesisConfig(derivePronunciations(entry('/lɛd/'))[0]);
    await assert.rejects(synthesizeGoogle(config,'test-token',async()=>{calls++;throw new Error('timeout');}),/timeout/);
    assert.equal(calls,1);
    await assert.rejects(synthesizeGoogle(config,'test-token',async()=>({ok:false,status:429})),/provider_http_429/);
    await assert.rejects(synthesizeGoogle(config,'test-token',async()=>({ok:true,json:async()=>({audioContent:'<html>error'})})),/invalid_provider_audio/);
});

test('reviewed lead primary stress is canonicalized while other words preserve stress',()=>{
    const lead=derivePronunciations(entry('/ˈliːd/'))[0];
    assert.equal(lead.sourceIpa,'/ˈliːd/');
    assert.equal(lead.phoneme,'liːd');
    assert.equal(derivePronunciations(entry('/ˈkæt/','cat'))[0].phoneme,'ˈkæt');
});
test('foreign-accent-only notes cannot become the default US recording',()=>{
    for(const label of ['British','Scotland','Received Pronunciation','Australian','Canadian']){
        const value=derivePronunciations({...entry('/lɛd/'),sourceSounds:[{ipa:'/lɛd/',note:label}]})[0];
        assert.equal(value.validationStatus,'unsupported',label);
    }
    assert.equal(derivePronunciations({...entry('/lɛd/'),sourceSounds:[{ipa:'/lɛd/',note:'Received Pronunciation, General American, CA]'}]})[0].validationStatus,'validated');
});

test('raw source accent tags are preserved and never bypass validation',()=>{
    const record=derivePronunciations({...entry('/lɛd/'),sourceSounds:[{ipa:'/lɛd/',raw_tags:['British']}]})[0];
    assert.equal(record.validationStatus,'unsupported');assert.match(record.label,/British/);
});


test('reviewed broad-US IPA notation maps common words without changing raw source',()=>{
    const cases=[['cat','/kæt/','kæt'],['dog','/dɑɡ/','dɑːɡ'],['word','/ˈwɝd/','ˈwɚd'],
        ['word','/wɜɹd/','wɚd'],['serendipity','/ˌsɛrənˈdɪpəti/','ˌsɛɹənˈdɪpətiː']];
    for(const [word,ipa,expected] of cases){
        const record=derivePronunciations({...entry(ipa,word),sourceSounds:[{ipa,tags:['General-American']}]})[0];
        assert.equal(record.validationStatus,'validated',word);
        assert.equal(record.phoneme,expected,word);
        assert.equal(record.sourceIpa,ipa,word);
        assert.equal(record.sourceDetail.ipa,ipa,word);
    }
});

test('US aliases retain diphthongs, vowel length and stress without inferring flaps',()=>{
    const options={explicitlyUS:true};
    assert.equal(validatePhoneme('/ˈɑ i ɔ u ɝ r ɔɪ oʊ aɪ aʊ eɪ iː/',options),'ˈɑː iː ɔː uː ɚ ɹ ɔɪ oʊ aɪ aʊ eɪ iː');
    assert.equal(validatePhoneme('/wɜːɹd/',options),'wɚd');
    assert.equal(validatePhoneme('/ɔ/',options),'ɔː');
    assert.equal(validatePhoneme('/ɝ/',options),'ɚ');
    assert.equal(validatePhoneme('/wɜːd/',options),null);
    assert.equal(validatePhoneme('/wɔɾɚ/',options),null);
    assert.equal(validatePhoneme('/tʰu/',options),null);
    assert.equal(validatePhoneme('/i̯/',options),null);
});

test('new notation aliases do not promote foreign or unlabeled source pronunciations',()=>{
    for(const tags of [[],['UK'],['Received-Pronunciation'],['Australia'],['Canada']]){
        const record=derivePronunciations({...entry('/ˌsɛrənˈdɪpəti/','serendipity'),sourceSounds:[{ipa:'/ˌsɛrənˈdɪpəti/',tags}]})[0];
        assert.equal(record.validationStatus,'unsupported',tags.join(','));
    }
    assert.equal(validatePhoneme('/dɑɡ/'),null);
});
