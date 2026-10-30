import { assetKeyFor, synthesisConfig, VOICE } from '../services/pronunciationService.js';
import { storedAssetState } from '../services/audioStorage.js';
import { allowanceStatus, billableUpperBound, synthesisEnabled } from '../services/providerBudget.js';

export function publicAsset(asset) {
    return { status: asset.status, assetKey: asset.asset_key, voice: VOICE,
        ...(asset.status === 'ready' ? { url: `/audio/${asset.asset_key}.mp3`, duration: asset.duration_seconds,
            checksum: asset.checksum } : { reason: asset.error_code ?? undefined }) };
}

export async function readAudio(pronunciationId, database) {
    const db = database ?? await import('../db/index.js');
    const { rows: [pronunciation] } = await db.query('SELECT * FROM pronunciations WHERE id=$1', [pronunciationId]);
    if (!pronunciation) return null;
    const config = synthesisConfig(pronunciation);
    const key = assetKeyFor(config);
    const { rows: [asset] } = await db.query('SELECT * FROM audio_assets WHERE asset_key=$1', [key]);
    if (asset) return publicAsset(await storedAssetState(asset));
    if (!['validated','text'].includes(pronunciation.validation_status)) {
        return { status: 'unavailable', reason: pronunciation.reason ?? 'pronunciation_unverified', voice: VOICE };
    }
    if (!synthesisEnabled()) return { status: 'unavailable', reason: 'synthesis_disabled', voice: VOICE };
    const allowance = await allowanceStatus(db,billableUpperBound(config));
    return { status: allowance.status === 'permitted' ? 'unprepared' : allowance.status,
        reason: allowance.reason, voice: VOICE };
}

export async function prepareAudio(pronunciationId, userId, database) {
    const db = database ?? await import('../db/index.js');
    return db.transaction(async client => {
        const { rows: [pronunciation] } = await client.query('SELECT * FROM pronunciations WHERE id=$1', [pronunciationId]);
        if (!pronunciation) return null;
        const config = synthesisConfig(pronunciation);
        const key = assetKeyFor(config);
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`audio:${key}`]);
        const { rows: [existing] } = await client.query('SELECT * FROM audio_assets WHERE asset_key=$1', [key]);
        // Never enqueue a retry after an uncertain transmission or a failed decode/write.
        if (existing) return publicAsset(await storedAssetState(existing));
        if (!['validated','text'].includes(pronunciation.validation_status)) {
            return { status: 'unavailable', reason: pronunciation.reason ?? 'pronunciation_unverified', voice: VOICE };
        }
        if (!synthesisEnabled()) return { status: 'unavailable', reason: 'synthesis_disabled', voice: VOICE };
        const allowance = await allowanceStatus(client,billableUpperBound(config));
        if (allowance.status !== 'permitted') return { status: allowance.status, reason: allowance.reason, voice: VOICE };
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`audio-user:${userId}`]);
        const { rows: [{ count }] } = await client.query(`SELECT count(*)::integer AS count FROM audio_jobs
            WHERE requested_by=$1 AND created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`, [userId]);
        if (count >= 100) return { status: 'unavailable', reason: 'daily_request_limit', voice: VOICE };
        await client.query(`INSERT INTO audio_assets(asset_key,config,status) VALUES($1,$2::jsonb,'pending')`, [key,JSON.stringify(config)]);
        await client.query(`INSERT INTO audio_jobs(asset_key,pronunciation_id,requested_by) VALUES($1,$2,$3)`, [key,pronunciationId,String(userId)]);
        return { status: 'pending', assetKey: key, voice: VOICE };
    });
}
