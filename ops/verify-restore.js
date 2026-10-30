// Compare an isolated restored database/files with a pre-backup JSON snapshot.
// This uses Docker's local psql; it never creates a worker or contacts a provider.
import { execFileSync } from 'node:child_process';
import { readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
const { values } = parseArgs({options:{
    container:{type:'string'}, database:{type:'string'}, audio:{type:'string'},
    expected:{type:'string'}, output:{type:'string'},
}});
if (!/^word_atlas_restore_[a-z0-9_]+$/.test(values.database||'') || !values.container || !values.audio || !values.expected) {
    throw new Error('Provide --container, --database word_atlas_restore_NAME, --audio and --expected.');
}
const sql = readFileSync(new URL('./backup-snapshot.sql',import.meta.url),'utf8');
const actual = JSON.parse(execFileSync('docker',['exec',values.container,'psql','-U','postgres','-d',values.database,'-Atc',sql],{encoding:'utf8'}));
const expected = JSON.parse(readFileSync(values.expected,'utf8'));
assert.deepEqual(actual,expected,'Restored dictionary, personal fixtures, audio metadata and usage must match snapshot');
const files = actual.audio.map(asset=>{
    assert.match(asset.asset_key,/^[a-f0-9]{64}$/);
    const bytes=readFileSync(join(values.audio,asset.asset_key+'.mp3'));
    const checksum=createHash('sha256').update(bytes).digest('hex');
    assert.equal(checksum,asset.checksum,'Restored final audio checksum');
    assert.equal(bytes.length,Number(asset.byte_size),'Restored final audio size');
    return {assetKey:asset.asset_key,checksum,bytes:bytes.length};
});
const result={verifiedAt:new Date().toISOString(),database:values.database,
    activeRelease:actual.release.id,entryCount:actual.entries,savedCount:actual.saved,historyCount:actual.history,
    usage:actual.usage,fixture:actual.fixture,audioFiles:files,providerCalls:0,matched:true};
if(values.output)writeFileSync(values.output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
