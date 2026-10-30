import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
    generateAuthenticationOptions, generateRegistrationOptions,
    verifyAuthenticationResponse, verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { query, transaction } from '../db/index.js';

const SETUP_MINUTES = 30;
const CEREMONY_MS = 5 * 60 * 1000;
const sha256 = value => createHash('sha256').update(value).digest();

export function passkeyConfig() {
    const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
    return { origin, rpID: process.env.WEBAUTHN_RP_ID || new URL(origin).hostname, rpName: 'Word Atlas' };
}

// The sign-in page lives at a secret path. Comparing hashes keeps the check
// constant-time whatever the length of the guess.
export function gateMatches(value) {
    const secret = process.env.LOGIN_PATH;
    if (!secret || secret.length < 16 || typeof value !== 'string') return false;
    return timingSafeEqual(sha256(value), sha256(secret));
}

const tokenHash = token => sha256(token).toString('hex');

// Run from the server command line (scripts/create-passkey-setup.js), never over HTTP.
export async function createSetupToken(userId, db = { query }) {
    const token = randomBytes(32).toString('base64url');
    await db.query(`INSERT INTO passkey_setup_tokens(token_hash,user_id,expires_at)
        VALUES($1,$2,now()+make_interval(mins => $3))`, [tokenHash(token), userId, SETUP_MINUTES]);
    return token;
}

async function setupUser(token) {
    if (typeof token !== 'string' || token.length > 100) return null;
    const { rows } = await query(`SELECT u.id,u.username FROM passkey_setup_tokens t JOIN users u ON u.id=t.user_id
        WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>now() AND u.active`, [tokenHash(token)]);
    return rows[0] ?? null;
}

function takeChallenge(req, kind) {
    const pending = req.session.passkey;
    delete req.session.passkey;
    if (!pending || pending.kind !== kind || Date.now() > pending.expires) return null;
    return pending;
}

export async function registrationOptions(req, token) {
    const user = await setupUser(token);
    if (!user) return null;
    const { rpID, rpName } = passkeyConfig();
    const { rows: existing } = await query('SELECT id,transports FROM passkeys WHERE user_id=$1', [user.id]);
    const options = await generateRegistrationOptions({
        rpName, rpID, userName: user.username, userDisplayName: 'Word Atlas owner',
        userID: new TextEncoder().encode(user.id), attestationType: 'none',
        excludeCredentials: existing.map(item => ({ id: item.id, transports: item.transports })),
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    req.session.passkey = { kind: 'register', challenge: options.challenge, tokenHash: tokenHash(token), expires: Date.now() + CEREMONY_MS };
    return options;
}

export async function verifyRegistration(req, token, response) {
    const pending = takeChallenge(req, 'register');
    if (!pending || pending.tokenHash !== tokenHash(token ?? '')) return null;
    const user = await setupUser(token);
    if (!user) return null;
    const { origin, rpID } = passkeyConfig();
    const { verified, registrationInfo } = await verifyRegistrationResponse({
        response, expectedChallenge: pending.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
    });
    if (!verified) return null;
    const { credential } = registrationInfo;
    const saved = await transaction(async client => {
        // The token is spent in the same transaction, so a link works exactly once.
        const spent = await client.query('UPDATE passkey_setup_tokens SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now()',
            [pending.tokenHash]);
        if (spent.rowCount !== 1) return false;
        await client.query('INSERT INTO passkeys(id,user_id,public_key,counter,transports) VALUES($1,$2,$3,$4,$5::jsonb)',
            [credential.id, user.id, Buffer.from(credential.publicKey), credential.counter, JSON.stringify(credential.transports ?? [])]);
        return true;
    });
    return saved ? user : null;
}

export async function authenticationOptions(req) {
    // No allowCredentials: the browser offers the saved passkey for this site, so
    // the page never reveals which accounts exist.
    const options = await generateAuthenticationOptions({ rpID: passkeyConfig().rpID, userVerification: 'required' });
    req.session.passkey = { kind: 'login', challenge: options.challenge, expires: Date.now() + CEREMONY_MS };
    return options;
}

export async function verifyAuthentication(req, response) {
    const pending = takeChallenge(req, 'login');
    if (!pending || typeof response?.id !== 'string') return null;
    const { rows: [passkey] } = await query(`SELECT p.*,u.username FROM passkeys p JOIN users u ON u.id=p.user_id
        WHERE p.id=$1 AND u.active`, [response.id]);
    if (!passkey) return null;
    const { origin, rpID } = passkeyConfig();
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
        response, expectedChallenge: pending.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
        credential: { id: passkey.id, publicKey: new Uint8Array(passkey.public_key), counter: Number(passkey.counter), transports: passkey.transports },
    });
    if (!verified) return null;
    await query('UPDATE passkeys SET counter=$2,last_used_at=now() WHERE id=$1', [passkey.id, authenticationInfo.newCounter]);
    return { id: passkey.user_id, username: passkey.username };
}
