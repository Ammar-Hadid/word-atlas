import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { pool, query } from '../src/db/index.js';
import { normalizeKaikki, hash } from '../src/import/normalizeKaikki.js';
import { beginRelease, insertBatch, validateRelease, publishRelease } from '../src/import/releases.js';
import { openSource, lines, checkDisk } from '../src/import/streamKaikki.js';

const { values } = parseArgs({ options: {
  release: { type: 'string' }, manifest: { type: 'string' }, file: { type: 'string' },
  limit: { type: 'string' }, 'sample-every': { type: 'string', default: '1' }, batch: { type: 'string', default: '250' },
  'disk-path': { type: 'string', default: '/data' }, 'min-free-gb': { type: 'string', default: '4' },
  'plain-jsonl': { type: 'boolean', default: false }, publish: { type: 'boolean', default: false },
  'allow-sample': { type: 'boolean', default: false },
} });
if (!values.release || !values.manifest) throw new Error('Usage: node scripts/import-kaikki.js --release ID --manifest path.json [--file dump.jsonl.gz] [--limit 10000] [--publish]');
const manifest = JSON.parse(await readFile(values.manifest, 'utf8'));
const batchSize = Number(values.batch), limit = Number(values.limit ?? Infinity), sampleEvery = Number(values['sample-every']);
if (!Number.isInteger(sampleEvery) || sampleEvery < 1 || sampleEvery > 10000) throw new Error('Invalid sample interval');
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000 || !(limit > 0)) throw new Error('Invalid batch or sample limit');
const minimumBytes = Number(values['min-free-gb']) * 1024 ** 3;
if (!Number.isFinite(minimumBytes) || minimumBytes < 4 * 1024 ** 3) throw new Error('Keep at least four GiB of free disk');
let source, lock, inputReceipt;
const started = Date.now();
const counters = { lines: 0, english_records: 0, selected_records: 0, non_english_records: 0, rejected_records: 0 };
try {
  lock = await pool.connect();
  const { rows } = await lock.query("SELECT pg_try_advisory_lock(hashtext('word-atlas-import')) AS locked");
  if (!rows[0].locked) throw new Error('Another Word Atlas importer holds the lock');
  await checkDisk(values['disk-path'], minimumBytes);
  const resumed=await beginRelease(values.release, manifest);
  if(resumed.inputReceipt) {
    inputReceipt=resumed.inputReceipt;
    Object.assign(counters,inputReceipt.counters);
    console.log(JSON.stringify({resumingValidation:true,sourceReadComplete:inputReceipt}));
  } else {
  source = await openSource({ file: values.file, sourceUrl: manifest.sourceUrl, gzip: !values['plain-jsonl'] });
  let batch = [], complete = true;
  for await (const line of lines(source.stream)) {
    counters.lines++;
    if (!line.trim()) continue;
    let record;
    try {
      const raw = JSON.parse(line);
      if (raw.lang_code !== 'en') { counters.non_english_records++; continue; }
      counters.english_records++;
      if ((counters.english_records - 1) % sampleEvery !== 0) continue;
      record = normalizeKaikki(raw);
    } catch (error) {
      counters.rejected_records++;
      await query('INSERT INTO import_rejections(release_id,line_number,reason,record_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [values.release, counters.lines, error.message.slice(0,400), hash(line)]);
      // Every malformed English record is visible. No partial source is published.
      if (counters.rejected_records > 100) throw new Error('Too many rejected records; see import_rejections', { cause: error });
      continue;
    }
    counters.selected_records++;
    batch.push(record);
    if (batch.length >= batchSize) {
      await checkDisk(values['disk-path'], minimumBytes);
      await insertBatch(values.release, batch); batch = [];
      if (counters.selected_records % 10000 === 0) console.log(JSON.stringify({ ...counters, elapsedSeconds: (Date.now()-started)/1000, rssMiB: Math.round(process.memoryUsage().rss/1024**2) }));
    }
    if (counters.selected_records >= limit) { complete = false; break; }
  }
  await insertBatch(values.release, batch);
  const checksum = source.checksum();
  source.close();
  if (complete && manifest.sourceBytes && Number(manifest.sourceBytes) !== source.bytes()) throw new Error('Source byte length differs from the release manifest');
  if(complete && manifest.sha256 && checksum!==manifest.sha256) throw new Error('Source checksum mismatch');
  inputReceipt={checksum,complete,sample:!complete || sampleEvery>1,compressed_bytes:source.bytes(),counters:{...counters},sample_every:sampleEvery,elapsed_seconds:(Date.now()-started)/1000};
  // Persist before identity mappings can change staged row IDs. A restart now
  // resumes finalization instead of replaying canonical IDs into remapped rows.
  await query('UPDATE dictionary_releases SET manifest=manifest || $2::jsonb WHERE id=$1',[values.release,JSON.stringify({inputReceipt})]);
  console.log(JSON.stringify({sourceReadComplete:inputReceipt}));
  }
  const {checksum,complete}=inputReceipt;
  const counts = await validateRelease(values.release, { checkResources: () => checkDisk(values['disk-path'],minimumBytes), checksum, complete, client: lock, sample: inputReceipt.sample, inputCounts: { ...counters, sample_every: inputReceipt.sample_every, compressed_bytes: inputReceipt.compressed_bytes, elapsed_seconds: inputReceipt.elapsed_seconds } });
  await checkDisk(values['disk-path'], minimumBytes);
  await query('ANALYZE entries'); await query('ANALYZE source_entries'); await query('ANALYZE forms');
  await checkDisk(values['disk-path'], minimumBytes);
  const publication = values.publish ? await publishRelease(values.release, { allowSample: values['allow-sample'] }) : null;
  console.log(JSON.stringify({ release: values.release, counts, checksum, complete, publication, elapsedSeconds: (Date.now()-started)/1000 }));
} catch (error) {
  source?.close();
  await query("UPDATE dictionary_releases SET status='failed',counts=$2 WHERE id=$1 AND status='staging'", [values.release, { ...counters, ...inputReceipt, error: error.message }]).catch(() => {});
  console.error(error.message); process.exitCode = 1;
} finally {
  if (lock) { await lock.query("SELECT pg_advisory_unlock(hashtext('word-atlas-import'))"); lock.release(); }
  await pool.end();
}
