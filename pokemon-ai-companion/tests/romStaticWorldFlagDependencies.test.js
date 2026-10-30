'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildStaticWorldFlagDependencies,candidateFlagLinksForMap}=require('../romStaticWorldFlagDependencies');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {adviseWorld}=require('../romWorldStateAdvisor');
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
test('compact map storage builds same dependencies as flat original audit',()=>{
 const input=syntheticAtlas();
 const flat=buildStaticWorldFlagDependencies({atlas:input});
 const maps=Array.from({length:248},(_,mapId)=>({mapId,interactions:[]}));
 for(const row of input.references)maps[row.mapId].interactions.push(row);
 const compact={verified:true,romSha256:KNOWN.red,
  summary:{referencedInteractions:1126},maps};
 const result=buildStaticWorldFlagDependencies({atlas:compact});
 assert.equal(result.verified,true,result.reason);
 assert.deepEqual(result.candidateLinks,flat.candidateLinks);
 assert.deepEqual(result.summary,flat.summary);
 const broken={...compact,maps:[...maps]};
 broken.maps[5]={mapId:6,interactions:maps[5].interactions};
 assert.equal(buildStaticWorldFlagDependencies({atlas:broken}).verified,false);
});
test('per-map candidate hints are symmetric and never prove consequences',()=>{
 const input=syntheticAtlas();
 const mapWriter=candidateFlagLinksForMap({atlas:input,mapId:10});
 const mapReader=candidateFlagLinksForMap({atlas:input,mapId:20});
 const unrelated=candidateFlagLinksForMap({atlas:input,mapId:21});
 assert.equal(mapWriter.verified,true);
 assert.equal(mapReader.verified,true);
 assert.equal(unrelated.verified,true);
 assert.equal(mapWriter.candidateLinkCount,1);
 assert.equal(mapReader.candidateLinkCount,1);
 assert.equal(unrelated.candidateLinkCount,0);
 assert.deepEqual(mapReader.links,mapWriter.links);
 assert.equal(mapReader.links[0].possibleWriterMapId,10);
 assert.equal(mapReader.links[0].possibleReaderMapId,20);
 assert.equal(mapReader.links[0].possibleWriterOrdinal,1);
 assert.equal(mapReader.links[0].possibleReaderOrdinal,1);
 assert.equal(mapReader.provenCausalLinks,0);
 assert.equal(mapReader.actionEffectsCertified,false);
 assert.equal(candidateFlagLinksForMap({atlas:input,mapId:248}).verified,false);
 assert.equal(candidateFlagLinksForMap({atlas:{},mapId:10}).verified,false);
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
  // The production API must accept compact profiles directly, without
  // allocating or persisting a duplicate flat 1126-reference world array.
  assert.equal(a.references,undefined);
  const graph=buildStaticWorldFlagDependencies({atlas:a});
  assert.equal(a.verified,true);
  assert.equal(graph.verified,true,graph.reason);
  assert.equal(graph.romSha256,p.hash.sha256);
  assert.equal(graph.summary.totalWorldObjects,1126);
  assert.equal(graph.summary.totalPotentialLinks,graph.candidateLinks.length);
  assert.equal(graph.summary.trustedCausalLinks,0);
  assert.equal(graph.summary.totalPotentialLinks,8);
  assert.equal(graph.summary.crossMapPotentialLinks,5);
  for(const link of graph.candidateLinks){
   assert.ok(link.possibleWriterMapId>=0&&link.possibleWriterMapId<248);
   assert.ok(link.possibleReaderMapId>=0&&link.possibleReaderMapId<248);
   assert.ok(Number.isInteger(link.possibleWriterOrdinal));
   assert.ok(Number.isInteger(link.possibleReaderOrdinal));
   const perMap=candidateFlagLinksForMap({atlas:a,
    mapId:link.possibleReaderMapId});
   assert.equal(perMap.verified,true,perMap.reason);
   assert.ok(perMap.links.some(row=>row.key===link.key&&
    row.possibleWriter===link.possibleWriter&&
    row.possibleReader===link.possibleReader));
   assert.equal(perMap.provenCausalLinks,0);
  }
  assert.equal(a.summary.staticFlagCandidateLinks,graph.candidateLinks.length);
  assert.equal(a.summary.staticFlagCandidateCrossMapLinks,
   graph.summary.crossMapPotentialLinks);
  assert.equal(a.summary.staticFlagCausalLinksVerified,0);
  const receiver=graph.candidateLinks[0].possibleReaderMapId;
  const advisor=adviseWorld({profile:p,mapId:receiver});
  assert.equal(advisor.verified,true,advisor.reason);
  assert.equal(advisor.romStaticFlagCandidatesVerified,true);
  assert.equal(advisor.romStaticFlagCandidatesWorldTotal,8);
  assert.equal(advisor.romStaticFlagCausalEffectsVerified,false);
  assert.ok(advisor.romStaticFlagCandidates.some(x=>
   x.possibleReaderMapId===receiver&&
   x.verifiedActionDependency===false&&
   x.causalLinkObserved===false));
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
