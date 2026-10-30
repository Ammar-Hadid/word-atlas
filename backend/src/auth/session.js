import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { pool, query } from '../db/index.js';

export const privateResponse = (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); };
export function sessionMiddleware() {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
    const Store = connectPg(session);
    return session({
        name: process.env.NODE_ENV === 'production' ? '__Host-wa' : 'wa',
        secret, store: new Store({ pool, tableName: 'sessions', createTableIfMissing: false }),
        resave: false, saveUninitialized: false,
        cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 86400000 },
    });
}
export function csrfToken(req) {
    req.session.csrf ||= randomBytes(24).toString('hex');
    return req.session.csrf;
}
export function csrfProtection(req, res, next) {
    if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
    const expectedOrigin = process.env.APP_ORIGIN || 'http://localhost:5173';
    const token = req.get('X-CSRF-Token') || '';
    const expected = req.session?.csrf || '';
    const tokenBytes=Buffer.from(token), expectedBytes=Buffer.from(expected);
    if (req.get('Origin') !== expectedOrigin || !expected || tokenBytes.length !== expectedBytes.length ||
        !timingSafeEqual(tokenBytes, expectedBytes)) {
        return res.status(403).json({ error: 'Please refresh and try again.', code: 'csrf' });
    }
    next();
}
export async function requireAuth(req, res, next) {
    if (!req.session?.userId) return res.status(401).json({ error: 'Sign in to synchronize your library.', code: 'sign_in_required' });
    const { rows } = await query('SELECT id,username FROM users WHERE id=$1 AND active', [req.session.userId]);
    if (!rows[0]) return res.status(401).json({ error: 'Session expired.', code: 'sign_in_required' });
    req.user = rows[0];
    next();
}
export async function rateLimit(bucket, subject, maximum, windowSeconds = 900) {
    const digest = createHash('sha256').update(subject).digest('hex');
    const { rows } = await query(`INSERT INTO request_limits(bucket,subject,window_start,requests)
        VALUES($1,$2,to_timestamp(floor(extract(epoch from now())/$3)*$3),1)
        ON CONFLICT(bucket,subject,window_start) DO UPDATE SET requests=request_limits.requests+1
        WHERE request_limits.requests < $4 RETURNING requests`, [bucket,digest,windowSeconds,maximum]);
    return rows.length > 0;
}
