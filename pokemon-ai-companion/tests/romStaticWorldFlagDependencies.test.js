'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildStaticWorldFlagDependencies}=require('../romStaticWorldFlagDependencies');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
function syntheticAtlas(){
 const refs=Array.from({length:1126},(_,i)=>({
  mapId:i%226,kind:'NPC',ordinal:Math.floor(i/226)+1,
  asmMemoryEffectExecuted:false,scriptCommand:'TX_FAR'
 }));
 const make=(index,operation)=>{
  const row=refs[index];row.scriptCommand='TX_START_ASM';
  row.scriptFileOffset=0x18000+index*128;
  row.asmCandidate={verified:true,txAsmFileOffset:row.scriptFileOffset,
   adjacentRomFlagBitPatterns:[{
    operation,bitIndex:81,domain:'WORLD_EVENT_BIT',
    operandsAndAdjacencyVerified:true,
    instructionSequenceExecuted:false,
    offset:row.scriptFileOffset+1,secondOffset:row.scriptFileOffset+4
   }]};
 };
 make(10,'SET_BIT');make(20,'BIT_TEST');
 return {verified:true,romSha256:KNOWN.red,summary:{referencedInteractions:1126},
  references:refs};
}
test('cross-map same-bit SET and TEST yield only a causal candidate link',()=>{
 const a=buildStaticWorldFlagDependencies({atlas:syntheticAtlas()});
 assert.equal(a.verified,true,a.reason);
 assert.equal(a.entries.length,2);
 assert.equal(a.candidateLinks.length,1);
 assert.equal(a.candidateLinks[0].possibleWriter,'10:NPC:1');
 assert.equal(a.candidateLinks[0].possibleReader,'20:NPC:1');
 assert.equal(a.candidateLinks[0].bitIndex,81);
 assert.equal(a.candidateLinks[0].sameMap,false);
 assert.equal(a.candidateLinks[0].verifiedActionDependency,false);
 assert.equal(a.candidateLinks[0].causalLinkObserved,false);
 assert.equal(a.summary.trustedCausalLinks,0);
 assert.equal(a.eventsCompletedCertified,false);
});
test('missing exact ROM identity or forged event evidence fails closed',()=>{
 assert.equal(buildStaticWorldFlagDependencies({}).verified,false);
 const unknown=syntheticAtlas();unknown.romSha256='f'.repeat(64);
 assert.equal(buildStaticWorldFlagDependencies({atlas:unknown}).verified,false);
 const bad=syntheticAtlas();bad.references[10].asmCandidate
  .adjacentRomFlagBitPatterns[0].instructionSequenceExecuted=true;
 assert.equal(buildStaticWorldFlagDependencies({atlas:bad}).verified,false);
 const badBit=syntheticAtlas();badBit.references[20].asmCandidate
  .adjacentRomFlagBitPatterns[0].bitIndex=2560;
 assert.equal(buildStaticWorldFlagDependencies({atlas:badBit}).verified,false);
});
for(const [name,env] of [['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']]){
 test('original '+name+' ROM: global cross-map flag candidate graph matches 1126 physical actors',
 {skip:!process.env[env]?'Original ROM path required':false},()=>{
  const rom=readRom(process.env[env]);
  const p=inspectRomBuffer(rom,name+'.gb');
  assert.equal(p.hash.sha256,KNOWN[name]);
  const a=p.world.interactionScriptAtlas;
  // Persisted profiles intentionally store the 248 per-map lists instead of
  // a duplicate global reference array and a potentially large cross-map graph.
  // Build its candidate links on demand from the verified map rows.
  const graph=buildStaticWorldFlagDependencies({atlas:{...a,
   references:a.maps.flatMap(m=>m.interactions||[])}});
  assert.equal(a.verified,true);
  assert.equal(graph.verified,true,graph.reason);
  assert.equal(graph.romSha256,p.hash.sha256);
  assert.equal(graph.summary.totalWorldObjects,1126);
  assert.equal(graph.summary.totalPotentialLinks,graph.candidateLinks.length);
  assert.equal(graph.summary.trustedCausalLinks,0);
  assert.equal(a.summary.staticFlagCandidateLinks,graph.candidateLinks.length);
  assert.equal(a.summary.staticFlagCandidateCrossMapLinks,
   graph.summary.crossMapPotentialLinks);
  assert.equal(a.summary.staticFlagCausalLinksVerified,0);
  assert.ok(graph.entries.length>0);
  for(const entry of graph.entries){
   const actual=rom[entry.opcodeOffset];
   assert.ok(actual===0xfa||actual===0x21);
   assert.equal(rom[entry.bitInstructionOffset],0xcb);
   assert.equal(entry.physicallyDecoded,true);
   assert.equal(entry.branchTakenVerified,false);
   assert.equal(entry.gameEffectVerified,false);
   assert.equal(entry.completedNow,null);
  }
  assert.ok(graph.candidateLinks.every(link=>
   link.verifiedActionDependency===false&&
   link.causalLinkObserved===false));
 });
}
