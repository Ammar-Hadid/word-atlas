# Google voice audition — 29 October 2026

Generated at the user's explicit request using the published monthly free tiers. No Gemini-TTS model, cloud storage, or paid hosting was used.

## Preflight

- Official pricing: https://cloud.google.com/text-to-speech/pricing — Chirp 3 HD and Neural2 each list 1,000,000 free characters per month.
- Account-wide current-month billing report showed only Gemini API usage, no Cloud Text-to-Speech line. Billing reporting can lag.
- Cloud Text-to-Speech was disabled in the other two projects linked to the billing account and enabled in the newly created Word Atlas project.
- Local generator enforced a 10,000-byte conservative input budget, counted attempts before sending, used an explicit six-voice allowlist, and did not automatically retry requests. Total conservative input size including pronunciation metadata: 2,954. All 30 requests completed.
- Expected synthesis charge: zero under the published free tiers and observed usage. This is not a real-time invoice confirmation or an account-wide hard spending cap.

## What each combined recording contains

1. lead, the verb meaning guide — IPA /liːd/
2. lead, the metal — IPA /lɛd/
3. Worcestershire. Anemone. Rural. Squirrel. Ubiquitous. Onomatopoeia.
4. Walk. Walked. Wanted. Watches. Children. Mice.
5. Break the ice. A blessing in disguise. Bite the bullet. Through thick and thin.

All voices use en-US, normal speaking rate, mono 24 kHz PCM. Each section is independently generated. Combined recordings insert 0.8 seconds of silence between sections locally. After listening, the user selected `en-US-Chirp3-HD-Iapetus` as the preferred voice on 29 October 2026.

The two meanings of lead use explicit pronunciation guidance (Chirp custom pronunciation or Neural2 SSML phoneme). These clips test rendering the intended pronunciation, not whether a model can infer an ambiguous meaning from isolated spelling. Other words and idioms use ordinary text without pronunciation overrides. Listen for accuracy; the output has not been independently transcribed or linguistically verified.

The separate section files and full request metadata are retained alongside the combined recordings. Replaying any saved recording does not call Google again.
