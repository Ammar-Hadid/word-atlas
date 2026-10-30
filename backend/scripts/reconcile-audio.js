// Offline recovery only: this module never authenticates to or calls a speech provider.
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioDirectory, recoverFile, inspectAudio, trimLeadingSilence, AUDIO_WORKER_LOCK } from '../src/workers/audioWorker.js';

export async function reconcileAudio({ database, directory=audioDirectory(), assetKey, after='', limit=100,
    inspect=inspectAudio, processFile=trimLeadingSilence }={}) {
    if(assetKey&&!/^[a-f0-9]{64}$/.test(assetKey))throw new Error('Invalid asset key');
    if(after&&!/^[a-f0-9]{64}$/.test(after))throw new Error('Invalid cursor');
    if(!Number.isInteger(limit)||limit<1||limit>1000)throw new Error('Limit must be between1and1000');
    const db=database??await import('../src/db/index.js');
    const lock=await db.pool.connect();
    let acquired=false;
    try{
    acquired=(await lock.query('SELECT pg_try_advisory_lock($1) AS acquired',[AUDIO_WORKER_LOCK])).rows[0].acquired;
    if(!acquired)throw new Error('Audio worker is active; retry reconciliation when it is idle.');
    const {rows}=await db.query(`SELECT asset_key FROM audio_assets
        WHERE ($1::text IS NULL OR asset_key=$1) AND asset_key>$2 AND (status<>'pending' OR EXISTS
            (SELECT 1 FROM audio_jobs j WHERE j.asset_key=audio_assets.asset_key AND j.dispatched_at IS NOT NULL))
        ORDER BY asset_key LIMIT $3`,[assetKey??null,after,limit]);
    const results=[];
    for(const row of rows){
        results.push(await db.transaction(async client=>{
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`audio:${row.asset_key}`]);
            const {rows:[asset]}=await client.query('SELECT * FROM audio_assets WHERE asset_key=$1 FOR UPDATE',[row.asset_key]);
            if(!asset)return {assetKey:row.asset_key,status:'absent'};
            try{
                const metadata=await recoverFile(directory,row.asset_key,inspect,processFile);
                if(!metadata)throw new Error('cached_file_missing');
                if(asset.checksum&&asset.checksum!==metadata.checksum)throw new Error('checksum_mismatch');
                await client.query(`UPDATE audio_assets SET status='ready',file_path=$2,checksum=$3,byte_size=$4,
                    duration_seconds=$5,error_code=NULL,updated_at=now() WHERE asset_key=$1`,
                [asset.asset_key,`${asset.asset_key}.mp3`,metadata.checksum,metadata.byteSize,metadata.duration]);
                await client.query("UPDATE audio_jobs SET status='complete',lease_until=NULL,error_code=NULL,updated_at=now() WHERE asset_key=$1",[asset.asset_key]);
                await client.query("UPDATE provider_usage SET state='consumed',updated_at=now() WHERE asset_key=$1",[asset.asset_key]);
                return {assetKey:asset.asset_key,status:'ready',checksum:metadata.checksum,bytes:metadata.byteSize};
            }catch(error){
                const reason=error.message==='cached_file_missing'?'cached_file_missing':'cached_file_corrupt';
                await client.query("UPDATE audio_assets SET status='unavailable',error_code=$2,updated_at=now() WHERE asset_key=$1",[asset.asset_key,reason]);
                return {assetKey:asset.asset_key,status:'unrecoverable',reason};
            }
        }));
    }
    return {checked:results.length,providerRequests:0,nextAfter:rows.length===limit?rows.at(-1).asset_key:null,results};
    }finally{
        try{if(acquired)await lock.query('SELECT pg_advisory_unlock($1)',[AUDIO_WORKER_LOCK]);}finally{lock.release();}
    }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
    await import('dotenv/config');
    const {values}=parseArgs({options:{asset:{type:'string'},after:{type:'string'},limit:{type:'string',default:'100'},directory:{type:'string'}}});
    try{
        const report=await reconcileAudio({assetKey:values.asset,after:values.after,limit:Number(values.limit),directory:values.directory});
        console.log(JSON.stringify(report,null,2));
        if(report.results.some(item=>item.status==='unrecoverable'))process.exitCode=1;
    }finally{const {pool}=await import('../src/db/index.js');await pool.end();}
}
