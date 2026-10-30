import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { pool } from '../src/db/index.js';

export async function migrate(db = pool) {
    const client = await db.connect();
    try {
        await client.query('SELECT pg_advisory_lock(801277)');
        await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
        const dir = new URL('../migrations/', import.meta.url);
        for (const name of (await readdir(dir)).filter(x => x.endsWith('.sql')).sort()) {
            const sql = await readFile(new URL(name, dir), 'utf8');
            const checksum = createHash('sha256').update(sql).digest('hex');
            const { rows } = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name]);
            if (rows.length) {
                if (rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
                continue;
            }
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name,checksum]);
                await client.query('COMMIT');
                console.log(`Applied ${name}`);
            } catch (error) { await client.query('ROLLBACK'); throw error; }
        }
    } finally { await client.query('SELECT pg_advisory_unlock(801277)'); client.release(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try { await migrate(); } finally { await pool.end(); }
}
