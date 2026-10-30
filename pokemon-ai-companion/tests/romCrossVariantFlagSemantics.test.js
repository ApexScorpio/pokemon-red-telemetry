'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {compareCrossVariantFlagSemantics}=require('../romCrossVariantFlagSemantics');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {buildStaticWorldFlagDependencies}=require('../romStaticWorldFlagDependencies');
const {lookupRomReference}=require('../romReferenceSemantics');
const SEEDS=[
 [1231,148,4,149,1,396938,121016,22718,22728,22737,22742],
 [1231,148,4,149,2,396938,121051,22753,22763,22772,22777],
 [1231,148,4,150,3,396938,379194,18752,18762,18771,18776],
 [1231,148,4,151,2,396938,121283,22985,22995,23004,23009],
 [1406,61,6,7,14,302825,105204,23290,23304,null,null],
 [192,66,1,66,3,120645,120904,22609,22614,null,null],
 [342,90,1,90,2,367508,367553,23495,23510,null,null],
 [343,90,2,90,1,367553,367508,23450,23465,null,null]
];
function fixture(){
 const results={};
 for(const v of ['red','blue','green']){
  const call=v==='green'?0x3c30:0x3c49;
  const links=SEEDS.map(([bit,wm,wo,rm,ro,wa,ra,bcpu,target,clear,set])=>{
   const wr=lookupRomReference({romSha256:KNOWN[v],mapId:wm,eventBitIndex:bit});
   const rd=lookupRomReference({romSha256:KNOWN[v],mapId:rm,eventBitIndex:bit});
   const isSign=rm===7;
   return {
    bitIndex:bit,domain:'WORLD_EVENT_BIT',
    possibleWriterMapId:wm,possibleReaderMapId:rm,
    possibleWriterKind:'NPC',possibleReaderKind:isSign?'SIGN':'NPC',
    possibleWriterOrdinal:wo,possibleReaderOrdinal:ro,
    writerRomHandlerOffset:wa,readerRomHandlerOffset:ra,
    possibleWriteOpcode:'SET_BIT',
    referenceEventName:wr.referenceEventName,
    writerReferenceMapName:wr.referenceMapName,
    readerReferenceMapName:rd.referenceMapName,
    referenceNameSource:'pret/pokered',
    referenceNameIsRomIntrinsic:false,
    readerConditionalDirectionVerified:true,
    readerBranchCondition:{verified:true,condition:'NZ',branchKind:'JR',
     branchCpu:bcpu,takenTargetCpu:target,jumpTakenIfBitSet:true,
     branchActuallyTaken:null},
    readerTwoAlternativeTextScriptsVerified:bit===1231,
    readerDualTextChoice:bit===1231?{
     alternativeTextScriptsStaticallyProven:true,
     sharedCallCpu:call,textOnBitClearPointerCpu:clear,
     textOnBitSetPointerCpu:set,dialogueShown:false,
     playerEffectVerified:false}:null,
    sameMap:wm===rm,verifiedActionDependency:false,
    causalLinkObserved:false,scriptEffectVerified:false
   };
  });
  results[v]={verified:true,romSha256:KNOWN[v],candidateLinks:links,
   summary:{totalPotentialLinks:8,crossMapPotentialLinks:5,trustedCausalLinks:0}};
 }
 return results;
}
test('the same eight static flag-branch relations allow four Green routine relocations',()=>{
 const result=compareCrossVariantFlagSemantics({graphs:fixture()});
 assert.equal(result.verified,true,result.reason);
 assert.equal(result.totalPermittedCallRelocations,4);
 assert.deepEqual(result.variants,['red','blue','green']);
 assert.equal(result.compareStaticBranchSemantics,true);
 assert.equal(result.sameCausalOutcomeVerified,false);
 assert.equal(result.byteIdenticalRomClaims,false);
 for(const entry of result.differences){
  assert.equal(entry.field,'readerDualTextChoice.sharedCallCpu');
  assert.equal(entry.redBlueCallCpu,15433);
  assert.equal(entry.greenCallCpu,15408);
  assert.equal(entry.sameVisibleGameplayOutcomeCertified,false);
 }
});
test('reject differences in event, actor, branch, condition, ROM identity or call target',()=>{
 const corruptions=[
  g=>{g.green.romSha256='a'.repeat(64)},
  g=>{g.green.candidateLinks[0].readerBranchCondition.condition='Z'},
  g=>{g.green.candidateLinks[0].readerBranchCondition.takenTargetCpu++},
  g=>{g.green.candidateLinks[0].possibleReaderMapId++},
  g=>{g.green.candidateLinks[0].referenceEventName='GUESS'},
  g=>{g.green.candidateLinks[0].readerDualTextChoice.sharedCallCpu=0x3c49},
  g=>{g.red.candidateLinks[0].readerDualTextChoice.sharedCallCpu=0x3c30},
  g=>{g.green.candidateLinks[0].causalLinkObserved=true},
  g=>{g.blue.candidateLinks[0].readerBranchCondition.branchActuallyTaken=true},
  g=>{g.green.candidateLinks.push(g.green.candidateLinks[0])}
 ];
 for(const modify of corruptions){
  const g=fixture();modify(g);
  assert.equal(compareCrossVariantFlagSemantics({graphs:g}).verified,false);
 }
 assert.equal(compareCrossVariantFlagSemantics({graphs:null}).verified,false);
});
test('reordered entries with the same identity are not a false variant difference',()=>{
 const g=fixture();g.blue.candidateLinks.reverse();g.green.candidateLinks.reverse();
 const result=compareCrossVariantFlagSemantics({graphs:g});
 assert.equal(result.verified,true,result.reason);
 assert.equal(result.differences.length,4);
});
test('real original ROMs: only the four permitted TX_FAR shared-call offsets differ',()=>{
 const paths={
  red:process.env.POKEMON_RED_ROM,
  blue:process.env.POKEMON_BLUE_ROM,
  green:process.env.POKEMON_GREEN_ROM
 };
 if(Object.values(paths).some(x=>!x))return;
 const graphs={};
 for(const [variant,loc] of Object.entries(paths)){
  const rom=readRom(loc);
  const p=inspectRomBuffer(rom,variant+'.gb');
  assert.equal(p.hash.sha256,KNOWN[variant]);
  graphs[variant]=buildStaticWorldFlagDependencies({
   atlas:p.world.interactionScriptAtlas});
  assert.equal(graphs[variant].verified,true,graphs[variant].reason);
 }
 const result=compareCrossVariantFlagSemantics({graphs});
 assert.equal(result.verified,true,result.reason);
 assert.equal(result.differences.length,4);
 assert.deepEqual([...new Set(result.differences.map(x=>x.key))].length,4);
});
