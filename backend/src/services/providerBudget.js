// No clock-based reset creates spending authority. Every allocation needs explicit evidence.
export const PROVIDER = 'google-chirp3-hd';
export const synthesisEnabled = () => process.env.AUDIO_SYNTHESIS_ENABLED === 'true';

export function billableUpperBound(config) {
    // UTF-8 bytes of the FULL request exceed Unicode input characters, including override metadata.
    return Buffer.byteLength(JSON.stringify({
        input: { text: config.text, customPronunciations: config.phoneme ? {
            pronunciations: [{ phrase: config.text, phoneticEncoding: 'PHONETIC_ENCODING_IPA', pronunciation: config.phoneme }],
        } : undefined },
        voice: { languageCode: config.language, name: config.voice },
        audioConfig: { audioEncoding: config.format, speakingRate: config.speakingRate },
    }));
}

export async function allowanceStatus(client, characters = 1) {
    const { rows } = await client.query(`SELECT * FROM provider_allowances
        WHERE provider=$1 AND period_start <= clock_timestamp() AND period_end > clock_timestamp()
          AND verified_until > clock_timestamp() AND revoked_at IS NULL
          AND period_start >= date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          AND period_end <= (date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'
        ORDER BY period_start DESC LIMIT 2`, [PROVIDER]);
    // Overlapping grants are an operational error, never two additive allowances.
    if (rows.length !== 1) return { status: 'unavailable', reason: 'allowance_unverified' };
    const allowance = rows[0];
    if (allowance.reserved_characters + characters > allowance.character_limit) {
        return { status: 'allowance_exhausted', reason: 'allowance_exhausted' };
    }
    return { status: 'permitted', allowance };
}

export async function reserveAllowance(client, assetKey, characters) {
    // All worker processes serialize against this lock before inspecting grant rows.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('word-atlas-google-budget'))");
    const {rows:[clock]}=await client.query('SELECT clock_timestamp() AS now');
    const now=clock.now;
    const { rows: existing } = await client.query('SELECT * FROM provider_usage WHERE asset_key=$1', [assetKey]);
    if (existing.length) return { status: 'already_reserved', usage: existing[0] };
    // A second operator grant in the same calendar month cannot raise the app's hard cap.
    const { rows: [{ total }] } = await client.query(`SELECT coalesce(sum(characters),0)::integer AS total
        FROM provider_usage WHERE created_at >= date_trunc('month',$1::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        AND created_at < (date_trunc('month',$1::timestamptz AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'`,[now]);
    if (total + characters > 100000) return { status: 'allowance_exhausted', reason: 'monthly_application_limit' };
    const permission = await allowanceStatus(client, characters);
    if (permission.status !== 'permitted') return permission;
    const { rows } = await client.query(`UPDATE provider_allowances SET reserved_characters=reserved_characters+$2
        WHERE id=$1 AND revoked_at IS NULL AND verified_until>clock_timestamp() AND period_end>clock_timestamp()
          AND reserved_characters+$2 <= character_limit RETURNING id`, [permission.allowance.id,characters]);
    if (!rows.length) return { status: 'unavailable', reason: 'allowance_changed' };
    await client.query(`INSERT INTO provider_usage(asset_key,allowance_id,characters,state,created_at)
        VALUES($1,$2,$3,'reserved',$4)`, [assetKey,permission.allowance.id,characters,now]);
    return { status: 'reserved', characters };
}

// Check again after reservation COMMIT, immediately before the sole external call.
// The margin also closes the period-end boundary during request dispatch/transport.
export async function verifyDispatchAllowance(client,assetKey) {
    const {rows}=await client.query(`SELECT u.asset_key FROM provider_usage u
        JOIN provider_allowances a ON a.id=u.allowance_id
        WHERE u.asset_key=$1 AND u.state='reserved' AND a.revoked_at IS NULL
          AND a.period_start <= clock_timestamp()
          AND a.period_end > clock_timestamp()+interval '30 seconds'
          AND a.verified_until > clock_timestamp()+interval '30 seconds'
          AND a.period_start >= date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          AND a.period_end <= (date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC'
          AND NOT EXISTS (SELECT 1 FROM provider_allowances other WHERE other.provider=a.provider AND other.id<>a.id
            AND other.revoked_at IS NULL AND other.period_start<=clock_timestamp()
            AND other.period_end>clock_timestamp() AND other.verified_until>clock_timestamp())`,[assetKey]);
    return rows.length===1;
}
