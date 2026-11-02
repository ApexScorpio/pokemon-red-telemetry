'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compareCrossVariantWorldGaps}=require('../romCrossVariantWorldGaps');
const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {buildWorldContentsIndex}=require('../romWorldContentsIndex');
const {buildCampaignWorldTracker}=require('../romCampaignWorldTracker');
const {buildMappingGapLedger}=require('../romMappingGapLedger');
const {buildWorldGapMatrix,exportWorldGapRowsV2}=require('../romWorldGapMatrix');
function synthetic(sha){
 const rows=[];
 for(let mapId=0;mapId<248;mapId++){
  if(mapId>=226){
   rows.push({mapId,hasNormalHeader:false,
    staticActionCount:null,scriptReferences:null,
    asmReferences:null,actionsWithoutRuntimeProof:null,
    nextEvidence:'Classify unused/reserved ID and any unassigned hidden item reference',
    gapClasses:'MAP_HEADER_NOT_A_NORMAL_GAMEPLAY_HEADER',
    gameplayVerified:false,completionPercent:null});
   continue;
  }
  const actions=mapId<184?9:8;
  const scripts=mapId<224?5:3;
  const asm=mapId<125?5:mapId===125?1:0;
  rows.push({mapId,hasNormalHeader:true,staticActionCount:actions,
   scriptReferences:scripts,asmReferences:asm,
   actionsWithoutRuntimeProof:actions,
   nextEvidence:asm>0?'RESOLVE_STATIC_ASM_CONTROL_FLOW_AND_EFFECTS':
    'VERIFY_SCRIPT_EFFECTS',
   gapClasses:(asm>0?'ASM_EFFECTS_NOT_CERTIFIED|':'')+
    'SCRIPT_EFFECTS_NOT_CERTIFIED|LIVE_PROGRESS_NOT_PROVEN',
   gameplayVerified:false,completionPercent:null});
 }
 return {verified:true,version:2,source:'OBJECT_ROWS_FOR_WINDOWS_POWERSHELL',
  romSha256:sha,gameplayCompletionCertified:false,
  counts:{mapIds:248,normalMapHeaders:226,noNormalHeader:22,
   staticallyIndexedActions:1992,scriptReferences:1126,
   asmReferences:626,unverifiedScriptEffects:1126,
   runtimeActionsUnproven:1992,gameplayCompletionPercentage:null},rows};
}
function trio(){
 return {red:synthetic(AUDITED_ROM_SHA256.RED),
  blue:synthetic(AUDITED_ROM_SHA256.BLUE),
  green:synthetic(AUDITED_ROM_SHA256.GREEN_INTERNATIONAL_1_2_1)};
}
test('all 248 identical static rows compare equal but never imply matching gameplay',()=>{
 const r=compareCrossVariantWorldGaps(trio());
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.mapsCompared,248);
 assert.equal(r.mapsWithEqualStaticCoverage,248);
 assert.equal(r.mapsWithDifferentStaticCoverage,0);
 assert.equal(r.differences.length,0);
 assert.equal(r.identicalStaticCoverage,true);
 assert.equal(r.gameplayEquivalent,null);
 assert.equal(r.gameplayCompletionCertified,false);
});
test('different map content is detected despite identical all-ROM totals',()=>{
 const t=trio();
 const x=t.blue.rows[0],y=t.blue.rows[200];
 const av=x.staticActionCount,pv=x.actionsWithoutRuntimeProof;
 x.staticActionCount=y.staticActionCount;
 x.actionsWithoutRuntimeProof=y.actionsWithoutRuntimeProof;
 y.staticActionCount=av;y.actionsWithoutRuntimeProof=pv;
 const r=compareCrossVariantWorldGaps(t);
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.mapsCompared,248);
 assert.equal(r.mapsWithDifferentStaticCoverage,2);
 assert.deepEqual(r.differences.map(x=>x.mapId),[0,200]);
 assert.equal(r.differenceCountsByField.staticActionCount,2);
 assert.equal(r.differenceCountsByField.actionsWithoutRuntimeProof,2);
 assert.equal(r.differences[0].values.staticActionCount.RED,9);
 assert.equal(r.differences[0].values.staticActionCount.BLUE,8);
 assert.equal(r.differences[0].semanticGameEffectProven,false);
});
test('reordering maps, duplicated IDs, or invented completion is refused',()=>{
 for(const modify of [
  t=>{t.blue.rows[7].mapId=8;},
  t=>{t.green.rows[2]=t.green.rows[3];},
  t=>{t.red.rows[9].gameplayVerified=true;},
  t=>{t.red.rows[10].completionPercent=100;}
 ]){
  const a=trio();modify(a);
  assert.equal(compareCrossVariantWorldGaps(a).verified,false);
 }
});
test('unknown or swapped original ROM identities cannot be compared',()=>{
 const a=trio();a.green.romSha256='0'.repeat(64);
 assert.equal(compareCrossVariantWorldGaps(a).verified,false);
 const b=trio();[b.red,b.blue]=[b.blue,b.red];
 assert.equal(compareCrossVariantWorldGaps(b).verified,false);
});
test('forged totals or impossible row relationships fail closed',()=>{
 const a=trio();a.blue.counts.asmReferences=625;
 assert.equal(compareCrossVariantWorldGaps(a).verified,false);
 const b=trio();b.blue.rows[2].asmReferences=6;
 assert.equal(compareCrossVariantWorldGaps(b).verified,false);
 const c=trio();c.green.rows[227].staticActionCount=0;
 assert.equal(compareCrossVariantWorldGaps(c).verified,false);
 const d=trio();d.blue.rows[1].actionsWithoutRuntimeProof=-1;
 assert.equal(compareCrossVariantWorldGaps(d).verified,false);
});
test('changing a static gap label never fabricates a game result',()=>{
 const a=trio();a.green.rows[160].nextEvidence='VERIFY_EXTRA_ROM_TEXT';
 const r=compareCrossVariantWorldGaps(a);
 assert.equal(r.verified,true,r.reason);
 assert.deepEqual(r.differences.map(x=>x.mapId),[160]);
 assert.deepEqual(r.differences[0].fields,['nextEvidence']);
 assert.equal(r.gameplayEquivalent,null);
 assert.equal(r.gameplayCompletionCertified,false);
});
test('original SHA-checked Red Blue Green are compared by every map ID',
 {skip:!['POKEMON_RED_ROM','POKEMON_BLUE_ROM','POKEMON_GREEN_ROM']
  .every(k=>process.env[k])?'Three original ROMs required':false},()=>{
  const input={};
  for(const [name,env] of [
   ['red','POKEMON_RED_ROM'],['blue','POKEMON_BLUE_ROM'],
   ['green','POKEMON_GREEN_ROM']]){
   const p=inspectRomBuffer(readRom(process.env[env]),name+'.gb');
   assert.equal(p.hash.sha256,KNOWN[name]);
   const index=buildWorldContentsIndex(p);
   const scriptAtlas=p.world.interactionScriptAtlas;
   const tracker=buildCampaignWorldTracker({index,scriptAtlas});
   const ledger=buildMappingGapLedger({profile:p,index,scriptAtlas,tracker});
   assert.equal(ledger.verified,true,ledger.reason);
   const matrix=buildWorldGapMatrix({ledger});
   assert.equal(matrix.verified,true,matrix.reason);
   input[name]=exportWorldGapRowsV2({matrix});
   assert.equal(input[name].verified,true,input[name].reason);
  }
  const comparison=compareCrossVariantWorldGaps(input);
  assert.equal(comparison.verified,true,comparison.reason);
  assert.equal(comparison.mapsCompared,248);
  assert.equal(comparison.mapsWithEqualStaticCoverage+
   comparison.mapsWithDifferentStaticCoverage,248);
  assert.equal(comparison.gameplayEquivalent,null);
  assert.equal(comparison.gameplayCompletionCertified,false);
 });
