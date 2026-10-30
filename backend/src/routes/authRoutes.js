import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { csrfToken, requireAuth, rateLimit } from '../auth/session.js';

const router = Router();
router.get('/me', async (req,res) => {
    const { rows } = req.session.userId ? await query('SELECT id,username FROM users WHERE id=$1 AND active',[req.session.userId]) : { rows: [] };
    res.json({ user: rows[0] || null, csrfToken: csrfToken(req) });
});
router.post('/login', async (req,res) => {
    if (!await rateLimit('login',req.ip,10)) return res.status(429).json({ error:'Too many attempts. Try again in 15 minutes.' });
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || Buffer.byteLength(password) > 72 || username.length > 80) return res.status(400).json({ error: 'Invalid login.' });
    const { rows } = await query('SELECT id,username,password_hash FROM users WHERE username=$1 AND active',[username]);
    // A real bcrypt hash for the missing-user path keeps password work comparable.
    const dummy = '$2b$12$6UjINhYtSA.d8X99kzIYbuR/fQ0CYk2kLgmzP.i8OlxstTt59bWqm';
    const valid = await bcrypt.compare(password, rows[0]?.password_hash || dummy);
    if (!valid || !rows[0]) return res.status(401).json({ error: 'Username or password is incorrect.' });
    await new Promise((resolve,reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = rows[0].id;
    const token = csrfToken(req);
    await new Promise((resolve,reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.json({ user: { id: rows[0].id, username: rows[0].username }, csrfToken: token });
});
router.post('/logout', requireAuth, async (req,res) => {
    await new Promise((resolve,reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie(process.env.NODE_ENV === 'production' ? '__Host-wa' : 'wa', { path:'/', httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax' });
    res.json({ ok:true });
});
export default router;
