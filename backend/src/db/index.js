import 'dotenv/config';
import pg from 'pg';

export const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_SIZE || 5),
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT || 15000),
    application_name: 'word-atlas',
});
pool.on('error', error => console.error('Database pool error', error.code));
export const query = (text, values) => pool.query(text, values);
// A dedicated transaction keeps cancellation scoped to this query and restores
// the normal timeout before its connection can return to the shared pool.
export async function queryWithTimeout(text, values, milliseconds = 200) {
    if (!Number.isInteger(milliseconds) || milliseconds < 1 || milliseconds > 1000) throw new Error('Invalid short query timeout');
    return transaction(async client => {
        await client.query("SELECT set_config('statement_timeout',$1,true)", [`${milliseconds}ms`]);
        return client.query(text, values);
    });
}
export async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
}
