import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { csrfProtection } from '../src/auth/session.js';
import { personalItem } from '../src/repositories/library.js';

const exec=promisify(execFile);
test('review: malformed Unicode CSRF tokens return403 without throwing',()=>{
    let status,next=false;
    const req={method:'POST',session:{csrf:'a'.repeat(48)},get:name=>name==='Origin'?(process.env.APP_ORIGIN||'http://localhost:5173'):'é'.repeat(48)};
    const res={status(value){status=value;return this;},json(){return this;}};
    assert.doesNotThrow(()=>csrfProtection(req,res,()=>{next=true;}));
    assert.equal(status,403);assert.equal(next,false);
});

test('review: migration rejects unstable timestamps and discards restricted content',()=>{
    assert.throws(()=>personalItem({word:'test'}),error=>error.status===400);
    const item=personalItem({word:'test',visitedAt:1000,userId:'other-user',definition:'Restricted text',examples:['Restricted'],sourceSnapshot:{definition:'Restricted'}});
    assert.deepEqual(Object.keys(item).sort(),['at','key','word']);
    assert.equal(item.at,'1970-01-01T00:00:01.000Z');
});

test('review: restore accepts owned raw audio and rejects links, traversal and corrupted checksums',async t=>{
    const dir=await mkdtemp(join(tmpdir(),'word-atlas-backup-review-'));
    t.after(()=>rm(dir,{recursive:true,force:true}));
    const extractor=fileURLToPath(new URL('../../ops/extract-backup.py',import.meta.url));
    const script=`import io,tarfile,hashlib,os,sys
root,mode=sys.argv[1:]
p=os.path.join(root,mode+'.tar')
with tarfile.open(p,'w') as t:
 def add(name,data):
  i=tarfile.TarInfo(name);i.size=len(data);t.addfile(i,io.BytesIO(data))
 data=b'synthetic database dump'
 add('database.dump',data)
 checksum='0'*64 if mode=='bad_checksum' else hashlib.sha256(data).hexdigest()
 add('manifest.txt',(checksum+'  database.dump\\n').encode())
 if mode=='raw':
  add('audio/'+'a'*64+'.mp3',b'clip')
  add('audio/'+'a'*64+'.source.wav',b'original')
  add('audio/'+'b'*64+'.source.mp3',b'original')
  add('audio/'+'b'*64+'.pending.mp3',b'partial')
 elif mode=='symlink':
  i=tarfile.TarInfo('audio/'+'a'*64+'.mp3');i.type=tarfile.SYMTYPE;i.linkname='/tmp/outside';t.addfile(i)
 elif mode=='nested':add('audio/a.mp3/escape.mp3',b'bad')
 elif mode=='traversal':add('../escape',b'bad')
os.mkdir(os.path.join(root,mode))
`;
    for(const mode of ['raw','symlink','nested','traversal','bad_checksum']){
        await exec('python3',['-c',script,dir,mode]);
        const operation=exec('python3',[extractor,join(dir,`${mode}.tar`),join(dir,mode)]);
        if(mode==='raw')assert.match((await operation).stdout,/checksum verified/);
        else await assert.rejects(operation,undefined,mode);
    }
});
