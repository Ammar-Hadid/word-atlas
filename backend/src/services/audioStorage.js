import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const audioDirectory = () => resolve(process.env.AUDIO_DIR || '/data/audio');

// A database row is not evidence that an independently backed-up media file exists.
// Missing/corrupt-sized files never authorize a replacement synthesis request.
export async function storedAssetState(asset) {
    if (!asset || asset.status !== 'ready') return asset;
    try {
        if (!/^[a-f0-9]{64}$/.test(asset.asset_key)) throw new Error('invalid_asset_key');
        const file = await stat(join(audioDirectory(),`${asset.asset_key}.mp3`));
        if (!file.isFile() || (asset.byte_size != null && file.size !== asset.byte_size)) throw new Error('invalid_audio_size');
        return asset;
    } catch {
        return { ...asset, status:'unavailable', error_code:'cached_file_missing' };
    }
}
