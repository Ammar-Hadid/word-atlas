import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';

// A minimal software passkey (ES256, "none" attestation) so tests can run the real
// WebAuthn registration and sign-in ceremonies without a browser or hardware.
const b64url = bytes => Buffer.from(bytes).toString('base64url');
const sha256 = bytes => createHash('sha256').update(bytes).digest();

function cbor(value) {
    const head = (major, length) => length < 24 ? Buffer.from([major << 5 | length])
        : length < 256 ? Buffer.from([major << 5 | 24, length]) : Buffer.from([major << 5 | 25, length >> 8, length & 255]);
    if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
    if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
    if (typeof value === 'string') return Buffer.concat([head(3, Buffer.byteLength(value)), Buffer.from(value)]);
    const entries = value instanceof Map ? [...value] : Object.entries(value);
    return Buffer.concat([head(5, entries.length), ...entries.flatMap(([key, item]) => [cbor(key), cbor(item)])]);
}

export function createSoftPasskey({ origin, rpID }) {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = publicKey.export({ format: 'jwk' });
    const credentialId = randomBytes(16);
    let counter = 0;
    let userHandle = null;
    const clientData = (type, challenge) => Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
    const counterBytes = () => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(++counter); return bytes; };

    return {
        id: b64url(credentialId),
        register(options) {
            userHandle = options.user.id;
            const coseKey = new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]);
            const length = Buffer.from([credentialId.length >> 8, credentialId.length & 255]);
            // Flags: user present, user verified, attested credential data included.
            const authData = Buffer.concat([sha256(rpID), Buffer.from([0x45]), counterBytes(), Buffer.alloc(16), length, credentialId, cbor(coseKey)]);
            return { id: b64url(credentialId), rawId: b64url(credentialId), type: 'public-key', clientExtensionResults: {},
                response: { clientDataJSON: b64url(clientData('webauthn.create', options.challenge)),
                    attestationObject: b64url(cbor({ fmt: 'none', attStmt: {}, authData })), transports: ['internal'] } };
        },
        authenticate(options) {
            const clientDataJSON = clientData('webauthn.get', options.challenge);
            const authData = Buffer.concat([sha256(rpID), Buffer.from([0x05]), counterBytes()]);
            const signature = sign('sha256', Buffer.concat([authData, sha256(clientDataJSON)]), privateKey);
            return { id: b64url(credentialId), rawId: b64url(credentialId), type: 'public-key', clientExtensionResults: {},
                response: { clientDataJSON: b64url(clientDataJSON), authenticatorData: b64url(authData),
                    signature: b64url(signature), userHandle } };
        },
    };
}
