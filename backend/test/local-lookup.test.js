import test from 'node:test';
import assert from 'node:assert/strict';
import { createWordDetailsController } from '../src/controllers/getWordDetails.js';

test('audio metadata failure preserves local meanings and does not call an editorial provider',async()=>{
    const word=[{id:'one',word:'lead',senses:[{senses:[{definition:'A metal.'}]}]},
        {id:'two',word:'lead',senses:[{senses:[{definition:'To guide.'}]}]}];
    const controller=createWordDetailsController({lookup:async()=>({word,quotes:[]}),
        pronunciations:async entry=>{if(entry.id==='one')throw new Error('audio-only failure');return[{id:'sound',status:'ready'}];},
        editorialSource:async()=>{throw new Error('A local result must not call the provider');}});
    const response={set(){return this;},json(body){this.body=body;return this;}};
    await controller({query:{term:'lead'}},response);
    assert.equal(response.body.word[0].senses[0].senses[0].definition,'A metal.');
    assert.equal(response.body.word[0].audioAvailability,'unavailable');
    assert.equal(response.body.word[1].pronunciations[0].status,'ready');
});

test('local-only preview misses never consume editorial quota',async()=>{
    const controller=createWordDetailsController({lookup:async()=>({word:[],suggestions:['word']}),
        editorialSource:async()=>{throw new Error('Speculative lookup reached provider');}});
    const response={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await controller({query:{term:'missing',localOnly:'1'}},response);
    assert.equal(response.code,404);
    assert.deepEqual(response.body.suggestions,['word']);
});
