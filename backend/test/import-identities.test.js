import test from 'node:test';
import assert from 'node:assert/strict';
import { planFamilyMappings } from '../src/import/identities.js';
test('unambiguous source edit keeps stable identity',()=>{
  assert.deepEqual(planFamilyMappings(['old'],[{id:'new'}]).mappings,[{from:'new',to:'old',reason:'single_unmatched_source_family'}]);
});
test('exact variants are matched before sole remaining homograph remap',()=>{
  assert.deepEqual(planFamilyMappings(['old1','old2'],[{id:'old1'},{id:'new2'}]).mappings,[{from:'new2',to:'old2',reason:'single_unmatched_source_family'}]);
});
test('ambiguous homograph changes never map by array order',()=>{
  const plan=planFamilyMappings(['old1','old2'],[{id:'new1'},{id:'new2'}]);
  assert.equal(plan.mappings.length,0);assert.equal(plan.ambiguous.length,1);
});
test('known signatures reuse prior mapping but split meanings cannot share it',()=>{
  assert.equal(planFamilyMappings(['stable'],[{id:'signature',alias:'stable'}]).mappings[0].to,'stable');
  const collision=planFamilyMappings(['stable'],[{id:'signature1',alias:'stable'},{id:'signature2',alias:'stable'}]);
  assert.equal(collision.mappings.length,0);assert.ok(collision.ambiguous.length);
});
