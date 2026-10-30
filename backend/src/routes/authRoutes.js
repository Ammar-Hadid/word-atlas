import { Router } from 'express';
import { query } from '../db/index.js';
import { csrfToken, requireAuth, rateLimit, signIn } from '../auth/session.js';
import { authenticationOptions, gateMatches, registrationOptions, verifyAuthentication, verifyRegistration } from '../auth/passkeys.js';

const router = Router();
const notFound = res => res.status(404).json({ error: 'Endpoint not found.' });

router.get('/me', async (req,res) => {
    const { rows } = req.session.userId ? await query('SELECT id,username FROM users WHERE id=$1 AND active',[req.session.userId]) : { rows: [] };
    res.json({ user: rows[0] || null, csrfToken: csrfToken(req) });
});

// Everything below answers exactly like a missing endpoint unless the caller
// knows the secret sign-in path, so visitors never learn that a login exists.
router.use('/passkey', async (req,res,next) => {
    if (!await rateLimit('passkey',req.ip,30)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    return gateMatches(req.method === 'GET' ? req.query.gate : req.body?.gate) ? next() : notFound(res);
});
router.get('/passkey/gate', (_req,res) => res.json({ ok: true }));

router.post('/passkey/login/options', async (req,res) => res.json(await authenticationOptions(req)));
router.post('/passkey/login/verify', async (req,res) => {
    const user = await verifyAuthentication(req, req.body?.response).catch(() => null);
    if (!user) return res.status(401).json({ error: 'That passkey was not recognised.' });
    res.json(await signIn(req, user));
});

router.post('/passkey/setup/options', async (req,res) => {
    const options = await registrationOptions(req, req.body?.token);
    return options ? res.json(options) : res.status(410).json({ error: 'This setup link has expired or was already used.' });
});
router.post('/passkey/setup/verify', async (req,res) => {
    const user = await verifyRegistration(req, req.body?.token, req.body?.response).catch(() => null);
    if (!user) return res.status(400).json({ error: 'The passkey could not be saved. Create a new setup link and try again.' });
    res.json(await signIn(req, user));
});

router.post('/logout', requireAuth, async (req,res) => {
    await new Promise((resolve,reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie(process.env.NODE_ENV === 'production' ? '__Host-wa' : 'wa', { path:'/', httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax' });
    res.json({ ok:true });
});
export default router;
