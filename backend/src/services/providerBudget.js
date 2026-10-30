// Google's official price list (checked 30 Oct 2026): Chirp 3 HD voices are free for
// the first 1 million characters each month, then US$30 per million. Every input
// character counts, spaces included. Word Atlas stops well before the free tier ends.
export const PROVIDER = 'google-chirp3-hd';
export const FREE_TIER_CHARACTERS = 1_000_000;
export const synthesisEnabled = () => process.env.AUDIO_SYNTHESIS_ENABLED === 'true';

const setting = (name, fallback) => Math.min(Number(process.env[name]) || fallback, FREE_TIER_CHARACTERS * 0.9);

// Visitors share less than the whole cap, so the rest stays reserved for the owner,
// and a daily share stops one busy day (or one bot) from using up the month.
export function limits() {
    const monthly = setting('AUDIO_MONTHLY_CHARACTER_LIMIT', 800_000);
    return {
        monthly,
        visitorMonthly: Math.min(setting('AUDIO_VISITOR_MONTHLY_LIMIT', 600_000), monthly),
        visitorDaily: setting('AUDIO_VISITOR_DAILY_LIMIT', 20_000),
    };
}
export const monthlyLimit = () => limits().monthly;

// Google bills the input text, including the custom pronunciation. UTF-8 bytes
// are never fewer than characters, so this is a safe upper bound.
export function billableUpperBound(config) {
    const bytes = value => Buffer.byteLength(value ?? '');
    return bytes(config.text) + (config.phoneme ? bytes(config.text) + bytes(config.phoneme) : 0);
}

// Google's billing month follows Pacific time.
const periodStart = unit => `date_trunc('${unit}',now() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles'`;

export async function monthUsage(client) {
    const { rows: [row] } = await client.query(`SELECT
            coalesce(sum(characters),0)::integer AS month,
            coalesce(sum(characters) FILTER (WHERE audience='visitor'),0)::integer AS visitor_month,
            coalesce(sum(characters) FILTER (WHERE audience='visitor' AND created_at >= ${periodStart('day')}),0)::integer AS visitor_day
        FROM provider_usage WHERE created_at >= ${periodStart('month')}`);
    return row;
}

export async function allowanceStatus(client, characters = 1, { audience = 'owner' } = {}) {
    const used = await monthUsage(client);
    const cap = limits();
    const fits = used.month + characters <= cap.monthly && (audience === 'owner'
        || (used.visitor_month + characters <= cap.visitorMonthly && used.visitor_day + characters <= cap.visitorDaily));
    return fits ? { status: 'permitted' } : { status: 'allowance_exhausted', reason: 'allowance_exhausted' };
}

export async function reserveAllowance(client, assetKey, characters, { audience = 'owner' } = {}) {
    // All worker processes serialize against this lock before reading usage.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('word-atlas-google-budget'))");
    const { rows: existing } = await client.query('SELECT * FROM provider_usage WHERE asset_key=$1', [assetKey]);
    if (existing.length) return { status: 'already_reserved', usage: existing[0] };
    const permission = await allowanceStatus(client, characters, { audience });
    if (permission.status !== 'permitted') return permission;
    await client.query(`INSERT INTO provider_usage(asset_key,characters,state,audience) VALUES($1,$2,'reserved',$3)`,
        [assetKey, characters, audience]);
    return { status: 'reserved', characters };
}

// The reservation must still exist right before the single provider call.
export async function verifyDispatchAllowance(client, assetKey) {
    const { rows } = await client.query("SELECT 1 FROM provider_usage WHERE asset_key=$1 AND state='reserved'", [assetKey]);
    return rows.length === 1;
}
