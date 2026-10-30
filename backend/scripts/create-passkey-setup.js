import { randomUUID } from 'node:crypto';
import { query, pool } from '../src/db/index.js';
import { createSetupToken } from '../src/auth/passkeys.js';

// Prints a one-time link (valid 30 minutes) that adds a passkey to the owner account.
// Run it on the server whenever you need your first passkey or one for a new device.
const origin = process.env.APP_ORIGIN;
const gate = process.env.LOGIN_PATH;
if (!origin || !gate || gate.length < 16) throw new Error('APP_ORIGIN and LOGIN_PATH (16+ characters) must be set.');
try {
    await query(`INSERT INTO users(id,username) VALUES($1,'owner') ON CONFLICT(username) DO NOTHING`, [randomUUID()]);
    const { rows: [owner] } = await query(`SELECT id FROM users WHERE username='owner' AND active`);
    const token = await createSetupToken(owner.id);
    console.log(`${origin}/k/${gate}?setup=${token}`);
} finally { await pool.end(); }
