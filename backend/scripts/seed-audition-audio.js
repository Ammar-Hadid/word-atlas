// Imports two already-authorized, retained Iapetus clips. Never calls a provider.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pool } from '../src/db/index.js';
import { lookupTerm } from '../src/repositories/entries.js';
import { registerEntryPronunciations, VOICE, validatePhoneme, hash } from '../src/services/pronunciationService.js';
import { storeRetainedAsset } from '../src/workers/audioWorker.js';

const source=resolve(process.argv[2] ?? '../docs/research/audio-comparison/google-free-tier-2026-10-29');
const manifest=JSON.parse(await readFile(join(source,'manifest.json'),'utf8'));
const clips=(manifest.results ?? manifest.requests ?? []).filter(item=>item.voice===VOICE&&['lead-guide','lead-metal'].includes(item.case)&&item.status==='complete');
if(clips.length!==2)throw new Error('Expected exactly two completed original Iapetus lead recordings.');
try {
    const result=await lookupTerm('lead');
    if(!result.word.length)throw new Error('Import and publish the open dictionary before seeding retained recordings.');
    const records=[];
    for(const entry of result.word)records.push(...await registerEntryPronunciations(entry));
    const report=[];
    for(const clip of clips){
        if(clip.input?.text!=='lead')throw new Error('Retained input does not match the entry.');
        const ipa=clip.input.customPronunciations?.pronunciations?.[0]?.pronunciation;
        if(!['liːd','lɛd'].includes(ipa))throw new Error('Unexpected retained pronunciation.');
        const matching=records.find(record=>validatePhoneme(record.ipa)?.replace(/^ˈ/u,'')===ipa&&record.status!=='unavailable');
        if(!matching){report.push({case:clip.case,status:'no_matching_source_pronunciation'});continue;}
        const wav=join(source,clip.file);
        const checksum=hash(await readFile(wav));
        const asset=await storeRetainedAsset({pronunciationId:matching.id,sourceFile:wav,sourceFormat:'wav',
            provenance:JSON.stringify({audition:'2026-10-29',case:clip.case,voice:VOICE,input:clip.input,
                originalSha256:checksum,requestFingerprint:clip.fingerprint,conversion:'Reviewed retained lead-only offsets: guide0.60s,metal0.50s, selected by original SHA256; libmp3lame96k; no rate change'})});
        report.push({case:clip.case,status:'ready',...asset});
    }
    console.log(JSON.stringify(report,null,2));
    if(report.some(item=>item.status!=='ready'))process.exitCode=1;
} finally {
    await pool.end();
}
