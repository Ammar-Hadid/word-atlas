import { createReadStream } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { Readable, Transform } from 'node:stream';
import { createHash } from 'node:crypto';

export async function checkDisk(path, minimumBytes = 4 * 1024 ** 3) {
  const disk = await statfs(path);
  const available = disk.bavail * disk.bsize;
  if (available < minimumBytes) throw new Error(`Low disk: ${available} bytes available, ${minimumBytes} required; import stopped`);
  return available;
}

export async function openSource({ file, sourceUrl, gzip = true }) {
  let source;
  if (file) source = createReadStream(file);
  else {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'kaikki.org') throw new Error('Only official HTTPS Kaikki downloads are accepted');
    const response = await fetch(url, { signal: AbortSignal.timeout(4 * 60 * 60 * 1000) });
    if (!response.ok) throw new Error(`Source download failed (${response.status})`);
    source = Readable.fromWeb(response.body);
  }
  const digest = createHash('sha256');
  let bytes = 0;
  const hasher = new Transform({ transform(chunk, _encoding, callback) { digest.update(chunk); bytes += chunk.length; callback(null, chunk); } });
  const stream = gzip ? createGunzip() : new Transform({ transform(chunk, _encoding, callback) { callback(null, chunk); } });
  source.on('error', error => hasher.destroy(error));
  hasher.on('error', error => stream.destroy(error));
  source.pipe(hasher).pipe(stream);
  return { stream, checksum: () => digest.digest('hex'), bytes: () => bytes, close: () => { source.destroy(); hasher.destroy(); stream.destroy(); } };
}

// A corrupt line cannot grow the process without bound. UTF-8 is decoded only
// after assembling the line, preserving characters split between stream chunks.
export async function* lines(stream, maxLineBytes = 8 * 1024 * 1024) {
  let buffer = Buffer.alloc(0);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
    let newline;
    while ((newline = buffer.indexOf(10)) !== -1) {
      if (newline > maxLineBytes) throw new Error('Source line exceeds byte limit');
      yield buffer.subarray(0, newline).toString('utf8');
      buffer = buffer.subarray(newline + 1);
    }
    if (buffer.length > maxLineBytes) throw new Error('Source line exceeds byte limit');
  }
  if (buffer.length) yield buffer.toString('utf8');
}
