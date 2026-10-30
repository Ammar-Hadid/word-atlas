import { assetKeyFor, synthesisConfig, VOICE } from '../services/pronunciationService.js';
import { storedAssetState } from '../services/audioStorage.js';
import { allowanceStatus, billableUpperBound, synthesisEnabled } from '../services/providerBudget.js';

const OWNER_DAILY_RECORDINGS = 100;
// These stop before any request reaches Google, so asking again later is safe;
// this is what lets recording resume once the monthly allowance resets.
const RETRYABLE = new Set(['failed', 'unavailable', 'allowance_exhausted']);

export function publicAsset(asset) {
    return { status: asset.status, assetKey: asset.asset_key, voice: asset.config?.voice ?? VOICE,
        ...(asset.status === 'ready' ? { url: `/audio/${asset.asset_key}.mp3`, duration: asset.duration_seconds,
            checksum: asset.checksum } : { reason: asset.error_code ?? undefined }) };
}

async function retryable(db, asset) {
    if (!RETRYABLE.has(asset.status)) return false;
    const { rows } = await db.query('SELECT 1 FROM provider_usage WHERE asset_key=$1', [asset.asset_key]);
    return rows.length === 0;
}

const audienceFor = userId => userId ? 'owner' : 'visitor';

export async function readAudio(pronunciationId, database, { userId } = {}) {
    const db = database ?? await import('../db/index.js');
    const { rows: [pronunciation] } = await db.query('SELECT * FROM pronunciations WHERE id=$1', [pronunciationId]);
    if (!pronunciation) return null;
    const config = synthesisConfig(pronunciation);
    const key = assetKeyFor(config);
    const { rows: [asset] } = await db.query('SELECT * FROM audio_assets WHERE asset_key=$1', [key]);
    if (asset && !await retryable(db, asset)) return publicAsset(await storedAssetState(asset));
    if (!['validated','text'].includes(pronunciation.validation_status)) {
        return { status: 'unavailable', reason: pronunciation.reason ?? 'pronunciation_unverified', voice: VOICE };
    }
    if (!synthesisEnabled()) return { status: 'unavailable', reason: 'synthesis_disabled', voice: VOICE };
    const allowance = await allowanceStatus(db, billableUpperBound(config), { audience: audienceFor(userId) });
    return { status: allowance.status === 'permitted' ? 'unprepared' : allowance.status,
        reason: allowance.reason, voice: VOICE };
}

// userId is the signed-in owner; without one the request comes from a visitor.
export async function prepareAudio(pronunciationId, userId, database) {
    const db = database ?? await import('../db/index.js');
    const audience = audienceFor(userId);
    return db.transaction(async client => {
        const { rows: [pronunciation] } = await client.query('SELECT * FROM pronunciations WHERE id=$1', [pronunciationId]);
        if (!pronunciation) return null;
        const config = synthesisConfig(pronunciation);
        const key = assetKeyFor(config);
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`audio:${key}`]);
        const { rows: [existing] } = await client.query('SELECT * FROM audio_assets WHERE asset_key=$1', [key]);
        if (existing) {
            // Never enqueue a retry after an uncertain transmission or a failed decode/write.
            if (!await retryable(client, existing)) return publicAsset(await storedAssetState(existing));
            await client.query('DELETE FROM audio_jobs WHERE asset_key=$1', [key]);
            await client.query('DELETE FROM audio_assets WHERE asset_key=$1', [key]);
        }
        if (!['validated','text'].includes(pronunciation.validation_status)) {
            return { status: 'unavailable', reason: pronunciation.reason ?? 'pronunciation_unverified', voice: VOICE };
        }
        if (!synthesisEnabled()) return { status: 'unavailable', reason: 'synthesis_disabled', voice: VOICE };
        const allowance = await allowanceStatus(client, billableUpperBound(config), { audience });
        if (allowance.status !== 'permitted') return { status: allowance.status, reason: allowance.reason, voice: VOICE };
        if (userId) {
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`audio-user:${userId}`]);
            const { rows: [{ count }] } = await client.query(`SELECT count(*)::integer AS count FROM audio_jobs
                WHERE requested_by=$1 AND created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`, [String(userId)]);
            if (count >= OWNER_DAILY_RECORDINGS) return { status: 'unavailable', reason: 'daily_request_limit', voice: VOICE };
        }
        await client.query(`INSERT INTO audio_assets(asset_key,config,status) VALUES($1,$2::jsonb,'pending')`, [key,JSON.stringify(config)]);
        await client.query(`INSERT INTO audio_jobs(asset_key,pronunciation_id,requested_by) VALUES($1,$2,$3)`,
            [key, pronunciationId, userId ? String(userId) : 'visitor']);
        return { status: 'pending', assetKey: key, voice: VOICE };
    });
}
