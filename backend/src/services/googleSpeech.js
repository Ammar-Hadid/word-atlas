import { readFile } from 'node:fs/promises';
import { VOICE } from './pronunciationService.js';

export function googleRequest(config) {
    if (config.provider !== 'google-chirp3-hd' || config.voice !== VOICE || config.language !== 'en-US'
        || config.format !== 'MP3' || config.speakingRate !== 1 || !config.text || config.text.length > 200) {
        throw new Error('unsupported_synthesis_configuration');
    }
    return {
        input: {
            text: config.text,
            ...(config.phoneme ? { customPronunciations: { pronunciations: [{ phrase: config.text,
                phoneticEncoding: 'PHONETIC_ENCODING_IPA', pronunciation: config.phoneme }] } } : {}),
        },
        voice: { languageCode: 'en-US', name: VOICE },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1 },
    };
}

export async function productionAccessToken() {
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!path || !process.env.GOOGLE_CLOUD_PROJECT) throw new Error('production_identity_missing');
    const credentials = JSON.parse(await readFile(path, 'utf8'));
    // Explicitly reject personal developer ADC and service-account impersonation via user tokens.
    if (credentials.type !== 'service_account' || credentials.project_id !== process.env.GOOGLE_CLOUD_PROJECT
        || !credentials.client_email?.endsWith('.iam.gserviceaccount.com') || !credentials.private_key) {
        throw new Error('production_identity_invalid');
    }
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    return client.getAccessToken();
}

// Token acquisition happens BEFORE the worker reserves/dispatched marker. There are no automatic retries.
export async function synthesizeGoogle(config, accessToken, fetcher = fetch) {
    const body = googleRequest(config);
    const token = typeof accessToken === 'string' ? accessToken : accessToken?.token;
    if (!token) throw new Error('production_identity_missing');
    const response = await fetcher('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
            'x-goog-user-project': process.env.GOOGLE_CLOUD_PROJECT },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const data = await response.json();
    if (typeof data.audioContent !== 'string' || data.audioContent.length > 4_000_000
        || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.audioContent)) throw new Error('invalid_provider_audio');
    return Buffer.from(data.audioContent, 'base64');
}
