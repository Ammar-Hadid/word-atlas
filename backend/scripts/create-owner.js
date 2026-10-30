import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, pool } from '../src/db/index.js';
const password = process.env.OWNER_PASSWORD;
if (!password || password.length < 16 || Buffer.byteLength(password)>72) throw new Error('Provide OWNER_PASSWORD (16–72 bytes) in the environment');
try {
    const hash = await bcrypt.hash(password,12);
    await query(`INSERT INTO users(id,username,password_hash) VALUES($1,'owner',$2)
        ON CONFLICT(username) DO NOTHING`,[randomUUID(),hash]);
    console.log('Owner provisioned; existing credentials preserved.');
} finally { await pool.end(); }
