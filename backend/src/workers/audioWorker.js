import { mkdir, open, readFile, rename, stat, statfs } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { hash, synthesisConfig, assetKeyFor } from '../services/pronunciationService.js';
import { billableUpperBound, reserveAllowance, synthesisEnabled, verifyDispatchAllowance } from '../services/providerBudget.js';
import { productionAccessToken, synthesizeGoogle } from '../services/googleSpeech.js';

const exec = promisify(execFile);
export const AUDIO_WORKER_LOCK = 768219407;
export const audioDirectory = () => resolve(process.env.AUDIO_DIR || '/data/audio');
const safeKey = key => {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('invalid_asset_key');
    return key;
};
export const assetPath = (directory,key,partial = false) => join(directory,`${safeKey(key)}${partial ? '.pending' : ''}.mp3`);

export async function checkDisk(directory) {
    const storage = await statfs(directory);
    // Two GiB remain available for PostgreSQL/WAL and unrelated VPS services.
    if (storage.bavail * storage.bsize < 2 * 1024 ** 3) throw new Error('low_disk');
}

export function validateMp3Header(bytes) {
    if (!Buffer.isBuffer(bytes) || bytes.length < 128 || bytes.length > 3_000_000) throw new Error('invalid_audio_size');
    if (bytes.subarray(0,3).toString() !== 'ID3' && !(bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
        throw new Error('invalid_audio_header');
    }
}

export async function inspectAudio(path) {
    const bytes = await readFile(path);
    validateMp3Header(bytes);
    const { stdout } = await exec('ffprobe',['-v','error','-show_entries','stream=codec_name:format=duration','-of','json',path],
        { timeout: 5000, maxBuffer: 65536 });
    const info = JSON.parse(stdout);
    const duration = Number(info.format?.duration);
    if (!info.streams?.some(stream => stream.codec_name === 'mp3') || !Number.isFinite(duration)
        || duration <= 0 || duration > 45) throw new Error('invalid_audio_duration');
    return { checksum: hash(bytes), byteSize: bytes.length, duration };
}

async function exists(path) {
    try { await stat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function syncDirectory(directory) {
    const handle = await open(directory,'r');
    try { await handle.sync(); } finally { await handle.close(); }
}

export function leadingTrimSeconds(log,paddingMs=100) {
    const events=[...log.matchAll(/silence_(start|end): ([0-9.]+)/g)];
    if(events[0]?.[1]!=='start'||Number(events[0][2])>0.001||events[1]?.[1]!=='end')return 0;
    return Math.max(0,Number(events[1][2])-paddingMs/1000);
}

export async function trimLeadingSilence(source,destination,{startSeconds}={}) {
    // Only these unchanged, reviewed audition WAV bytes receive fixed trim points.
    // New Google recordings cannot accidentally inherit an audition's timing.
    const reviewed={
        '85f442a2368022fcc32e769a31626db19ab1a744467779be7b2b2b6f1fcc058c':0.60,
        '9060b70982c23b3ec7482519e3e636b40b5ab1aef1ca8e3efd55f03152e2fa8b':0.50,
    };
    let start=startSeconds??reviewed[hash(await readFile(source))];
    if(start===undefined){
        const {stderr}=await exec('ffmpeg',['-nostdin','-hide_banner','-i',source,'-af',
            'silencedetect=noise=-50dB:d=0.02','-f','null','-'],{timeout:15000,maxBuffer:262144});
        start=leadingTrimSeconds(stderr);
    }
    if(!Number.isFinite(start)||start<0||start>10)throw new Error('invalid_trim_point');
    const {stdout}=await exec('ffprobe',['-v','error','-show_entries','format=duration','-of','json',source],{timeout:5000,maxBuffer:65536});
    const duration=Number(JSON.parse(stdout).format?.duration);
    if(!Number.isFinite(duration)||duration<0.15)throw new Error('invalid_audio_duration');
    if(duration-start<0.15)start=0; // Preserve doubtful short clips in full.
    // Only remove measured leading silence. Never change pace, pitch, gain, or trailing speech.
    await exec('ffmpeg',['-nostdin','-v','error','-y','-i',source,'-af',`atrim=start=${start},asetpts=PTS-STARTPTS`,
        '-codec:a','libmp3lame','-b:a','96k',destination],{timeout:15000,maxBuffer:65536});
    return {removedSeconds:start};
}

const sourcePath=(directory,key,format='mp3')=>join(directory,`${safeKey(key)}.source.${format==='wav'?'wav':'mp3'}`);
async function persistSource(directory,key,bytes,format) {
    const path=sourcePath(directory,key,format);
    if(await exists(path)){
        if(hash(await readFile(path))!==hash(bytes))throw new Error('source_audio_conflict');
        return path;
    }
    const handle=await open(path,'wx',0o600);
    try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
    await syncDirectory(directory);
    return path;
}

export async function publishBytes(directory,key,bytes,inspect=inspectAudio,processFile=trimLeadingSilence,format='mp3') {
    if(format==='mp3')validateMp3Header(bytes);
    else if(bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WAVE')throw new Error('invalid_audio_header');
    const path=assetPath(directory,key);
    if(await exists(path))return inspect(path);
    // Preserve the unmodified returned recording BEFORE any decoding, trimming, or encoding.
    const source=await persistSource(directory,key,bytes,format);
    const temporary=assetPath(directory,key,true);
    const processing=await processFile(source,temporary);
    const metadata={...await inspect(temporary),sourceChecksum:hash(bytes),...(processing??{})};
    const handle=await open(temporary,'r');
    try{await handle.sync();}finally{await handle.close();}
    await rename(temporary,path);
    await syncDirectory(directory);
    return metadata;
}

export async function recoverFile(directory,key,inspect=inspectAudio,processFile=trimLeadingSilence) {
    const path=assetPath(directory,key);
    if(await exists(path))return inspect(path);
    const temporary=assetPath(directory,key,true);
    if(await exists(temporary)){
        try{
            const metadata=await inspect(temporary);
            await rename(temporary,path);await syncDirectory(directory);return metadata;
        }catch{
            // A partial processed file can be rebuilt from our retained source, never from Google.
        }
    }
    for(const format of ['mp3','wav']){
        const source=sourcePath(directory,key,format);
        if(await exists(source))return publishBytes(directory,key,await readFile(source),inspect,processFile,format);
    }
    if(await exists(temporary))throw new Error('invalid_audio_header');
    return null;
}

async function inTransaction(client,work) {
    await client.query('BEGIN');
    try { const result = await work(); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
}

async function markReady(client,key,metadata) {
    await inTransaction(client,async () => {
        await client.query(`UPDATE audio_assets SET status='ready',file_path=$2,checksum=$3,byte_size=$4,
            duration_seconds=$5,error_code=NULL,config=config||$6::jsonb,updated_at=now() WHERE asset_key=$1`,
        [key,`${key}.mp3`,metadata.checksum,metadata.byteSize,metadata.duration,JSON.stringify(metadata.sourceChecksum?{processingResult:{sourceChecksum:metadata.sourceChecksum,removedSeconds:metadata.removedSeconds}}:{})]);
        await client.query("UPDATE audio_jobs SET status='complete',lease_until=NULL,error_code=NULL,updated_at=now() WHERE asset_key=$1",[key]);
        await client.query("UPDATE provider_usage SET state='consumed',updated_at=now() WHERE asset_key=$1",[key]);
    });
}

async function markStopped(client,key,status,reason) {
    const jobStatus = status === 'uncertain' ? 'uncertain' : status === 'failed' ? 'failed' : 'blocked';
    await inTransaction(client,async () => {
        await client.query('UPDATE audio_assets SET status=$2,error_code=$3,updated_at=now() WHERE asset_key=$1',[key,status,reason]);
        await client.query('UPDATE audio_jobs SET status=$2,error_code=$3,lease_until=NULL,updated_at=now() WHERE asset_key=$1',[key,jobStatus,reason]);
        if (status === 'uncertain') await client.query("UPDATE provider_usage SET state='uncertain',updated_at=now() WHERE asset_key=$1",[key]);
    });
}

export async function processAudioJob(job,{
    client, directory = audioDirectory(), inspect = inspectAudio, processFile = trimLeadingSilence, diskCheck = checkDisk,
    getToken = productionAccessToken, synthesize = synthesizeGoogle, reserve = reserveAllowance,
    enabled = synthesisEnabled, verifyDispatch = verifyDispatchAllowance,
} = {}) {
    const key = job.asset_key;
    let dispatched = Boolean(job.dispatched_at);
    try {
        const recovered = await recoverFile(directory,key,inspect,processFile);
        if (recovered) { await markReady(client,key,recovered); return 'recovered'; }
        if (dispatched) { await markStopped(client,key,'uncertain','outcome_uncertain'); return 'uncertain'; }
        if (!enabled()) { await markStopped(client,key,'unavailable','synthesis_disabled'); return 'unavailable'; }
        await diskCheck(directory);
        // Fail credential setup before taking a synthesis reservation or sending text.
        const token = await getToken();
        const reservation = await inTransaction(client,async () => {
            const permission = await reserve(client,key,billableUpperBound(job.config));
            if (permission.status !== 'reserved') return permission;
            await client.query(`UPDATE audio_jobs SET dispatched_at=now(),attempts=1,updated_at=now()
                WHERE asset_key=$1 AND dispatched_at IS NULL`,[key]);
            return permission;
        });
        if (reservation.status !== 'reserved') {
            const uncertain = reservation.status === 'already_reserved';
            const status = uncertain ? 'uncertain' : reservation.status;
            await markStopped(client,key,status,reservation.reason ?? (uncertain ? 'outcome_uncertain' : 'allowance_unverified'));
            return status;
        }
        if(!await verifyDispatch(client,key)){
            await markStopped(client,key,'unavailable','allowance_expired_before_dispatch');
            return 'unavailable';
        }
        dispatched = true;
        const bytes = await synthesize(job.config,token);
        const metadata = await publishBytes(directory,key,bytes,inspect,processFile);
        await markReady(client,key,metadata);
        return 'ready';
    } catch (error) {
        // A completed file wins even if the database update or atomic publication was interrupted.
        try {
            const recovered = await recoverFile(directory,key,inspect,processFile);
            if (recovered) { await markReady(client,key,recovered); return 'recovered'; }
        } catch { /* retain invalid/incomplete files for operator inspection; never blindly regenerate */ }
        const status = dispatched ? 'uncertain' : error.message === 'low_disk' ? 'unavailable' : 'failed';
        const allowedReasons = new Set(['low_disk','production_identity_missing','production_identity_invalid',
            'invalid_audio_header','invalid_audio_size','invalid_audio_duration','invalid_provider_audio']);
        await markStopped(client,key,status,dispatched ? 'outcome_uncertain'
            : allowedReasons.has(error.message) ? error.message : 'audio_preparation_failed');
        return status;
    }
}

// Reuse a previously authorized Iapetus recording without contacting any provider.
// Caller must verify the retained request's exact text/phoneme/voice/rate against pronunciationId.
export async function storeRetainedAsset({ pronunciationId, mp3Path, sourceFile=mp3Path, sourceFormat='mp3', startSeconds, provenance, database, directory = audioDirectory() }) {
    if (!provenance || typeof provenance !== 'string') throw new Error('retained_provenance_required');
    const db = database ?? await import('../db/index.js');
    const { rows: [pronunciation] } = await db.query('SELECT * FROM pronunciations WHERE id=$1',[pronunciationId]);
    if (!pronunciation || pronunciation.validation_status !== 'validated') throw new Error('invalid_retained_pronunciation');
    const config = synthesisConfig(pronunciation);
    const key = assetKeyFor(config);
    await mkdir(directory,{recursive:true,mode:0o750});
    const metadata = await publishBytes(directory,key,await readFile(sourceFile),inspectAudio,
        (source,destination)=>trimLeadingSilence(source,destination,{startSeconds}),sourceFormat);
    await db.transaction(async client => {
        await client.query(`INSERT INTO audio_assets(asset_key,config,status) VALUES($1,$2::jsonb,'pending')
            ON CONFLICT(asset_key) DO NOTHING`,[key,JSON.stringify({...config,retainedProvenance:provenance})]);
        await client.query(`UPDATE audio_assets SET status='ready',file_path=$2,checksum=$3,byte_size=$4,
            duration_seconds=$5,error_code=NULL,config=config||$6::jsonb,updated_at=now() WHERE asset_key=$1`,
        [key,`${key}.mp3`,metadata.checksum,metadata.byteSize,metadata.duration,JSON.stringify(metadata.sourceChecksum?{processingResult:{sourceChecksum:metadata.sourceChecksum,removedSeconds:metadata.removedSeconds}}:{})]);
        await client.query("UPDATE audio_jobs SET status='complete',lease_until=NULL,updated_at=now() WHERE asset_key=$1",[key]);
    });
    return {assetKey:key,...metadata};
}

export async function runWorkerOnce({ database, directory = audioDirectory(), ...dependencies } = {}) {
    const db = database ?? await import('../db/index.js');
    await mkdir(directory,{ recursive: true, mode: 0o750 });
    const client = await db.pool.connect();
    let locked = false;
    try {
        const { rows: [{ acquired }] } = await client.query('SELECT pg_try_advisory_lock($1) AS acquired',[AUDIO_WORKER_LOCK]);
        if (!acquired) return 'busy';
        locked = true;
        // A lease permits recovery, never a second request after an ambiguous transmission.
        const { rows: abandoned } = await client.query(`SELECT j.*,a.config FROM audio_jobs j
            JOIN audio_assets a USING(asset_key) WHERE j.status='processing' AND j.lease_until < now()
            ORDER BY j.created_at LIMIT 20`);
        for (const job of abandoned) {
            if (!job.dispatched_at) {
                await client.query("UPDATE audio_jobs SET status='queued',lease_until=NULL WHERE asset_key=$1",[job.asset_key]);
            } else await processAudioJob(job,{client,directory,...dependencies});
        }
        const job = await inTransaction(client,async () => {
            const { rows: [candidate] } = await client.query(`SELECT j.*,a.config FROM audio_jobs j
                JOIN audio_assets a USING(asset_key) WHERE j.status='queued'
                ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1`);
            if (!candidate) return null;
            await client.query("UPDATE audio_jobs SET status='processing',lease_until=now()+interval '90 seconds',updated_at=now() WHERE asset_key=$1",[candidate.asset_key]);
            return candidate;
        });
        return job ? await processAudioJob(job,{client,directory,...dependencies}) : 'idle';
    } finally {
        if (locked) await client.query('SELECT pg_advisory_unlock($1)',[AUDIO_WORKER_LOCK]);
        client.release();
    }
}

export async function startAudioWorker({ signal, ...options } = {}) {
    while (!signal?.aborted) {
        try { await runWorkerOnce(options); }
        catch (error) { console.error('Audio worker database/storage failure:',error.code ?? error.name); }
        await new Promise(resolve => setTimeout(resolve,1000));
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await import('dotenv/config');
    const controller = new AbortController();
    process.once('SIGTERM',() => controller.abort());
    process.once('SIGINT',() => controller.abort());
    await startAudioWorker({signal:controller.signal});
    const { pool } = await import('../db/index.js');
    await pool.end();
}
