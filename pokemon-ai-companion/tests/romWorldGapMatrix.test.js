'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildWorldGapMatrix,mapWorldGapDetail,exportWorldGapRowsV2}=
 require('../romWorldGapMatrix');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const {buildWorldContentsIndex}=require('../romWorldContentsIndex');
const {buildCampaignWorldTracker}=require('../romCampaignWorldTracker');
const {buildMappingGapLedger}=require('../romMappingGapLedger');
const SHA=KNOWN.red;
function fixture(){
 const maps=[];
 for(let id=0;id<248;id++){
  if(id>=226){
   maps.push({mapId:id,staticHeaderVerified:false,
    gapClass:'NO_NORMAL_MAP_HEADER',
    unassignedHiddenItems:id===230?1:0,interactionCount:0,
    asmReferences:0,runtimeCompletionVerified:false});
   continue;
  }
  const interactions=id<224?5:3;
  const asm=id<125?5:id===125?1:0;
  const actions=id<184?9:8;
  const gapClasses=[];
  if(asm>0)gapClasses.push('ASM_EFFECTS_NOT_CERTIFIED');
  gapClasses.push('SCRIPT_EFFECTS_NOT_CERTIFIED','LIVE_PROGRESS_NOT_PROVEN');
  maps.push({mapId:id,staticHeaderVerified:true,
   staticActionCount:actions,interactionCount:interactions,
   asmReferences:asm,runtimeActionsUnproven:actions,
   unverifiedScriptEffects:interactions,missingTextPointers:0,
   gapClasses,status:'PARTIAL_STATIC_MAPPING',
   runtimeCompletionVerified:false});
 }
 const priorities=maps.filter(m=>m.staticHeaderVerified)
  .sort((a,b)=>b.asmReferences-a.asmReferences||
    b.unverifiedScriptEffects-a.unverifiedScriptEffects||a.mapId-b.mapId)
  .slice(0,15).map(m=>({mapId:m.mapId,asmReferences:m.asmReferences,
   unverifiedScriptEffects:m.unverifiedScriptEffects}));
 return {verified:true,romSha256:SHA,
  source:'VERIFIED_ROM_STATIC_GAP_LEDGER_V1',
  mapping100PercentCertified:false,runtimeEffectsCertified:false,
  maps,summary:{
   mapIds:248,normalMapHeaders:226,idsWithoutNormalHeader:22,
   staticallyIndexedActions:1992,scriptReferences:1126,
   asmTextReferences:626,unverifiedScriptEffects:1126,
   textPointersPending:0,liveEventBitValuesVerified:0,
   runtimeActionsUnproven:1992,hiddenItemsWithoutNormalHeader:1},
  priorities};
}
test('all 248 map IDs reconcile against independent static totals',()=>{
 const a=buildWorldGapMatrix({ledger:fixture()});
 assert.equal(a.verified,true,a.reason);
 assert.equal(a.maps.length,248);
 assert.equal(a.summary.normalMapHeaders,226);
 assert.equal(a.summary.noNormalHeader,22);
 assert.equal(a.summary.staticallyIndexedActions,1992);
 assert.equal(a.summary.scriptReferences,1126);
 assert.equal(a.summary.asmReferences,626);
 assert.equal(a.summary.runtimeActionsUnproven,1992);
 assert.equal(a.summary.gameplayCompletionPercentage,null);
 assert.equal(a.gameplayCompletionCertified,false);
 assert.deepEqual(a.topUnresolvedMaps.map(m=>m.mapId),Array.from({length:15},(_,i)=>i));
});
test('local gap lookup covers all maps without claiming gameplay completion',()=>{
 const matrix=buildWorldGapMatrix({ledger:fixture()});
 for(let id=0;id<248;id++){
  const entry=mapWorldGapDetail({matrix,mapId:id});
  assert.equal(entry.verified,true,'map '+id);
  assert.equal(entry.mapId,id);
  assert.equal(entry.completionPercent,null);
  assert.equal(entry.gameplayVerified,false);
 }
 assert.equal(mapWorldGapDetail({matrix,mapId:248}).verified,false);
 assert.equal(mapWorldGapDetail({matrix,mapId:-1}).verified,false);
});
test('non-normal IDs never become empty completed gameplay maps',()=>{
 const matrix=buildWorldGapMatrix({ledger:fixture()});
 for(let i=226;i<248;i++){
  const row=matrix.maps[i];
  assert.equal(row.category,'NO_NORMAL_MAP_HEADER');
  assert.equal(row.staticActionCount,null);
  assert.equal(row.gameplayVerified,false);
  assert.equal(row.pending[0],'MAP_HEADER_NOT_A_NORMAL_GAMEPLAY_HEADER');
 }
 assert.equal(matrix.summary.unassignedHiddenItems,1);
});
test('a swapped or duplicated map ID is rejected rather than silently omitted',()=>{
 const x=fixture();x.maps[20].mapId=21;
 assert.equal(buildWorldGapMatrix({ledger:x}).verified,false);
 const y=fixture();y.maps[3]=y.maps[4];
 assert.equal(buildWorldGapMatrix({ledger:y}).verified,false);
});
test('forged action completion or mismatched world totals fail closed',()=>{
 const a=fixture();a.maps[1].runtimeCompletionVerified=true;
 assert.equal(buildWorldGapMatrix({ledger:a}).verified,false);
 const b=fixture();b.maps[0].staticActionCount++;
 assert.equal(buildWorldGapMatrix({ledger:b}).verified,false);
 const c=fixture();c.summary.unverifiedScriptEffects--;
 assert.equal(buildWorldGapMatrix({ledger:c}).verified,false);
 const d=fixture();d.priorities[0].mapId=200;
 assert.equal(buildWorldGapMatrix({ledger:d}).verified,false);
});
test('unknown ROM or forged gap classes cannot produce certified world report',()=>{
 const x=fixture();x.romSha256='0'.repeat(64);
 assert.equal(buildWorldGapMatrix({ledger:x}).verified,false);
 const y=fixture();y.maps[0].gapClasses=['LIVE_PROGRESS_NOT_PROVEN'];
 assert.equal(buildWorldGapMatrix({ledger:y}).verified,false);
 const z=fixture();z.maps[230].unassignedHiddenItems=-1;
 assert.equal(buildWorldGapMatrix({ledger:z}).verified,false);
});
for(const [variant,env] of [['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],['green','POKEMON_GREEN_ROM']]){
 test('real '+variant+' ROM provides an independent 248-ID gap matrix',
 {skip:!process.env[env]?'Original ROM not provided':false},()=>{
  const b=readRom(process.env[env]);
  const p=inspectRomBuffer(b,variant+'.gb');
  assert.equal(p.hash.sha256,KNOWN[variant]);
  const index=buildWorldContentsIndex(p);
  const scriptAtlas=p.world.interactionScriptAtlas;
  const tracker=buildCampaignWorldTracker({index,scriptAtlas});
  const ledger=buildMappingGapLedger({profile:p,index,scriptAtlas,tracker});
  assert.equal(ledger.verified,true,ledger.reason);
  const report=buildWorldGapMatrix({ledger});
  assert.equal(report.verified,true,report.reason);
  assert.equal(report.romSha256,KNOWN[variant]);
  assert.equal(report.maps.length,248);
  assert.equal(report.summary.mapIds,248);
  assert.equal(report.summary.scriptReferences,1126);
  assert.equal(report.summary.asmReferences,626);
  assert.equal(report.summary.staticallyIndexedActions,1992);
  assert.equal(report.summary.gameplayCompletionPercentage,null);
  assert.equal(report.gameplayCompletionCertified,false);
  assert.equal(report.topUnresolvedMaps.length,15);
  assert.equal(report.topUnresolvedMaps[0].mapId,ledger.priorities[0].mapId);
  const flat=exportWorldGapRowsV2({matrix:report});
  assert.equal(flat.verified,true,flat.reason);
  assert.equal(flat.rows.length,248);
  assert.equal(flat.counts.staticallyIndexedActions,1992);
  assert.equal(flat.counts.scriptReferences,1126);
  assert.equal(flat.counts.asmReferences,626);
  assert.equal(flat.gameplayCompletionCertified,false);
 });
}

test('PowerShell-compatible map rows V2 export all 248 IDs as named objects',()=>{
 const report=exportWorldGapRowsV2({matrix:buildWorldGapMatrix({ledger:fixture()})});
 assert.equal(report.verified,true,report.reason);
 assert.equal(report.version,2);
 assert.equal(report.rows.length,248);
 assert.equal(report.counts.normalMapHeaders,226);
 assert.equal(report.counts.noNormalHeader,22);
 assert.equal(report.counts.staticallyIndexedActions,1992);
 assert.equal(report.counts.scriptReferences,1126);
 assert.equal(report.counts.asmReferences,626);
 assert.equal(report.counts.runtimeActionsUnproven,1992);
 assert.equal(report.gameplayCompletionCertified,false);
 assert.equal(report.counts.gameplayCompletionPercentage,null);
 assert.deepEqual(Object.keys(report.rows[0]),[
  'mapId','hasNormalHeader','staticActionCount','scriptReferences',
  'asmReferences','actionsWithoutRuntimeProof','nextEvidence',
  'gapClasses','gameplayVerified','completionPercent'
 ]);
 assert.equal(report.rows[0].hasNormalHeader,true);
 assert.equal(report.rows[226].hasNormalHeader,false);
 assert.equal(report.rows[226].staticActionCount,null);
});
test('JSON array round-trip keeps named properties and all 248 records',()=>{
 const exportData=exportWorldGapRowsV2({matrix:buildWorldGapMatrix({ledger:fixture()})});
 const json=JSON.stringify(exportData.rows);
 const rows=JSON.parse(json);
 assert.equal(rows.length,248);
 assert.deepEqual(rows.map(x=>x.mapId),Array.from({length:248},(_,i)=>i));
 assert.equal(rows.every(x=>typeof x==='object'&&!Array.isArray(x)),true);
 assert.equal(rows[0].gameplayVerified,false);
 assert.equal(rows[247].completionPercent,null);
 assert.equal(rows[247].nextEvidence,'Classify unused/reserved ID and any unassigned hidden item reference');
});
test('flattened export fails closed on forged runtime completion and row gaps',()=>{
 const a=buildWorldGapMatrix({ledger:fixture()});
 a.maps[0].gameplayVerified=true;
 assert.equal(exportWorldGapRowsV2({matrix:a}).verified,false);
 const b=buildWorldGapMatrix({ledger:fixture()});
 b.maps[2].mapId=3;
 assert.equal(exportWorldGapRowsV2({matrix:b}).verified,false);
 const c=buildWorldGapMatrix({ledger:fixture()});
 c.maps[5].actionsWithoutRuntimeProof=900;
 assert.equal(exportWorldGapRowsV2({matrix:c}).verified,false);
 const d=buildWorldGapMatrix({ledger:fixture()});
 d.summary.runtimeActionsUnproven++;
 assert.equal(exportWorldGapRowsV2({matrix:d}).verified,false);
});
test('PowerShell export refuses unknown ROM and non-normal maps with fake actions',()=>{
 assert.equal(exportWorldGapRowsV2({}).verified,false);
 const a=buildWorldGapMatrix({ledger:fixture()});
 a.romSha256='0'.repeat(64);
 assert.equal(exportWorldGapRowsV2({matrix:a}).verified,false);
 const b=buildWorldGapMatrix({ledger:fixture()});
 b.maps[226].staticActionCount=0;
 assert.equal(exportWorldGapRowsV2({matrix:b}).verified,false);
});
