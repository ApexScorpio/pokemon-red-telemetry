'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../retroarchClient.js'),'utf8');
function method(from,to){
 const start=source.indexOf('  '+from+'(');
 const end=source.indexOf('  '+to+'(',start+2);
 assert.ok(start>=0&&end>start,'Method boundaries must exist');
 return source.slice(start,end);
}

// Extract only the synchronous cache computation. The later live scripted
// battle readback is intentionally async and is tested independently.
function remoteRouteCacheBlock(){
 const first=source.indexOf('    const remoteSelection=selectGlobalFlagTargets({');
 const last='    this.latestState.globalFlagItemRoutes=this._globalFlagItemRoutes;';
 const end=source.indexOf(last,first);
 assert.ok(first>=0&&end>first,'Route selection and cache assignment must exist');
 const block=source.slice(first,end+last.length);
 assert.match(block,/this\._globalFlagItemKey!==remoteKey/);
 assert.match(block,/planGlobalFlagItemRoutes\(\{/);
 assert.doesNotMatch(block,/\bawait\b/,'Async ROM readback must not enter synchronous route tests');
 return block;
}
const transient=[
 'globalCampaignLedger','globalCampaignObjectives','globalCampaignDelta',
 'worldRecentFlagChanges','worldAdvisor','romCrossMapItemRoute',
 'romCrossMapItemRoutes',
 'romWorldEventAtlas','romWorldReferenceDelta','worldRecentNamedChanges',
 'romElevatorOptions'
];
test('persistState excludes transient RAM/ROM evidence from both on-disk caches',()=>{
 const writes=[];
 const fakeFs={writeFileSync:(p,s)=>writes.push({p,s})};
 const Agent=vm.runInNewContext('(class Agent {\n'+
   method('persistState','loadPersistedActionHistory')+'\n})',{
   fs:fakeFs,require:name=>{
     assert.equal(name,'path');
     return {join:(...s)=>s.join('/')};
   },__dirname:'/mock/app'
 });
 const client=new Agent();
 const state={connected:true,isSimulation:false,trainerName:'RED',
   areaInfo:{name:'Route 4'},mapId:15,party:[{speciesId:25}],badges:[],
   worldAdvisor:{verified:true},
   globalCampaignLedger:{verified:true,mapProgress:[{mapId:15}]},
   globalCampaignDelta:{verified:true,changes:[{kind:'HIDDEN_ITEM_FLAG_RAISED'}]},
   worldRecentFlagChanges:{verified:true,events:[{mapId:15}]},
   romCrossMapItemRoute:{verified:true,found:true},
   romCrossMapItemRoutes:{verified:true,results:[{found:true}]},
   globalCampaignObjectives:{verified:true,objectives:[{mapId:15}]},
   romWorldEventAtlas:{verified:true,events:[{eventBitIndex:34}]},
   romWorldReferenceDelta:{verified:true,changes:[{eventBitIndex:34}]},
   worldRecentNamedChanges:{verified:true,events:[{eventBitIndex:34}]},
   romElevatorOptions:{verified:true,options:[{destinationMapId:127}]}};
 client.persistState(state);
 assert.equal(writes.length,2);
 assert.equal(writes[0].s,writes[1].s);
 const saved=JSON.parse(writes[0].s);
 for(const name of transient)assert.equal(Object.hasOwn(saved,name),false);
 assert.equal(saved.party[0].speciesId,25);
 assert.equal(state.globalCampaignLedger.verified,true);
});
test('saved history remains untouched by world invalidation',()=>{
 const Agent=vm.runInNewContext('(class Agent {\n'+
   method('invalidateWorldEvidence','loadPersistedState')+'\n})');
 const agent=new Agent();
 let resets=0;
 agent._worldCampaignSession={reset:()=>resets++};
 agent._worldReferenceSession={reset:()=>resets++};
 agent.latestState={actionHistory:[{text:'Treinador'}],
   dialogHistory:[{text:'Ola'}],worldAdvisor:{verified:true},
   globalCampaignLedger:{verified:true},
   worldRecentFlagChanges:{verified:true,events:[{kind:'OLD'}]}};
 agent.invalidateWorldEvidence('ROM não coincide');
 assert.equal(resets,2);
 assert.equal(agent.latestState.worldAdvisor.verified,false);
 assert.equal(agent.latestState.globalCampaignLedger.verified,false);
 assert.equal(agent.latestState.worldRecentFlagChanges.events.length,0);
 assert.equal(agent.latestState.romCrossMapItemRoutes.verified,false);
 assert.equal(agent.latestState.romCrossMapItemRoutes.results.length,0);
 assert.equal(agent.latestState.romElevatorOptions.verified,false);
 assert.equal(agent.latestState.worldRecentNamedChanges.verified,false);
 assert.equal(agent.latestState.actionHistory[0].text,'Treinador');
 assert.equal(agent.latestState.dialogHistory[0].text,'Ola');
});
test('connection and ROM changes invalidate cached world evidence before publishing',()=>{
 assert.match(source,/this\._worldCampaignSession=new CampaignFlagSession\(\)/);
 assert.match(source,/this\.invalidateWorldEvidence\('Novo arranque/);
 assert.match(source,/this\.invalidateWorldEvidence\('ROM ativa mudou/);
 assert.match(source,/this\.invalidateWorldEvidence\('Blocos RAM incompletos/);
 assert.match(source,/this\.invalidateWorldEvidence\('Mapa RAM alterado/);
 const publication=source.indexOf('const targetScopeStable=matchesTargetScope(this,pollTargetScope)');
 const campaign=source.indexOf('const campaignSession=this._worldCampaignSession.ingestPublished({');
 const persist=source.lastIndexOf('this.persistState(this.latestState);');
 assert.ok(publication>0&&campaign>publication&&persist>campaign);
 assert.doesNotMatch(source,/this\._worldCampaignSession\.ingest\(/);
 const guarded=source.slice(campaign,campaign+900);
 assert.match(guarded,/publicationGuardVerified:matchesTargetScope\(this,pollTargetScope\)/);
 assert.match(guarded,/targetGeneration:pollTargetScope\.generation/);
 assert.match(guarded,/pollSequence:this\._scriptedBattlePollSequence/);
 assert.doesNotMatch(source,/previousGlobalLedger=this\.latestState\.globalCampaignLedger/);
});

test('world reference and elevator adapters are imported, refreshed and invalidated',()=>{
 assert.match(source,/require\('\.\/romWorldReferenceSession'\)/);
 assert.match(source,/require\('\.\/romElevatorChoices'\)/);
 const finalPositionGuard=source.indexOf('const targetScopeStable=matchesTargetScope(this,pollTargetScope)');
 const namedEventIngest=source.indexOf('const namedChanges=this._worldReferenceSession.ingestPublished({');
 const finalPersist=source.lastIndexOf('this.persistState(this.latestState);');
 assert.ok(finalPositionGuard>0&&namedEventIngest>finalPositionGuard&&finalPersist>namedEventIngest);
 assert.doesNotMatch(source,/this\._worldReferenceSession\.ingest\(/);
 const namedPublish=source.slice(namedEventIngest,namedEventIngest+850);
 assert.match(namedPublish,/publicationGuardVerified:matchesTargetScope\(this,pollTargetScope\)/);
 assert.match(namedPublish,/targetGeneration:pollTargetScope\.generation/);
 assert.match(namedPublish,/pollSequence:this\._scriptedBattlePollSequence/);
 assert.match(source,/this\.latestState\.romElevatorOptions=elevatorOptionsForMap\(/);
 assert.match(source,/this\.latestState\.worldRecentNamedChanges=namedChanges\.recent/);
 assert.match(source,/this\._worldReferenceSession\.reset\(reason\)/);
});

test('all new local and multi-map route evidence is ephemeral and invalidated',()=>{
 const sourceBody=method('persistState','loadPersistedActionHistory');
 assert.match(sourceBody,/'romLocalExitAccess'/);
 assert.match(sourceBody,/'romWorldDetourCycles'/);
 assert.match(sourceBody,/'romVariantTerrainEvidence'/);
 const invalidation=method('invalidateWorldEvidence','loadPersistedState');
 assert.match(invalidation,/romLocalExitAccess=\{verified:false/);
 assert.match(invalidation,/romWorldDetourCycles=\{verified:false/);
 assert.match(invalidation,/romVariantTerrainEvidence=\{verified:false/);
 assert.match(invalidation,/this\._worldDetourCyclesKey=null/);
 assert.match(source,/localExitAccess\(\{/);
 assert.match(source,/this\.latestState\.romVariantTerrainEvidence=verifyTerrainVariant\(/);
 assert.match(source,/this\._worldDetourCycles=suggestWorldDetours\(/);
});

test('first-map Cut/Surf and LAST_MAP hints depend on variant-matched ROM grid',()=>{
 assert.match(source,/this\.latestState\.romVariantTerrainEvidence=verifyTerrainVariant\(/);
 assert.match(source,/lastMapGuide:this\.latestState\.romStaticMapGuide/);
 assert.match(source,/this\.latestState\.romVariantTerrainEvidence\?\.verified===true/);
 assert.match(source,/romWorldDetourCycles=\{verified:false/);
});

test('outdoor routes are stripped when any of 78 audited map connections diverges',()=>{
 assert.match(source,/require\('\.\/romOutdoorReferenceGuard'\)/);
 assert.match(source,/verifyOutdoorConnectionVariant\(\{/);
 assert.match(source,/outdoorReferenceMismatch:true/);
 assert.match(source,/outdoorConnections:null/);
 const persisted=method('persistState','loadPersistedActionHistory');
 assert.match(persisted,/'romOutdoorReferenceEvidence'/);
 assert.match(persisted,/'romWarpGraph'/);
 const invalidated=method('invalidateWorldEvidence','loadPersistedState');
 assert.match(invalidated,/romOutdoorReferenceEvidence=\{verified:false/);
 assert.match(invalidated,/romWarpGraph=\{verified:false/);
});

test('verified boundary offsets are cached by ROM SHA and never persisted as RAM facts',()=>{
 assert.match(source,/require\('\.\/romOutdoorAlignment'\)/);
 assert.match(source,/this\._outdoorAlignment=validateOutdoorAlignment\(\{/);
 assert.match(source,/outdoorAlignment:this\.latestState\.romOutdoorAlignment/);
 assert.match(source,/this\.latestState\.romOutdoorAlignment=\{verified:false/);
 const persisted=method('persistState','loadPersistedActionHistory');
 assert.match(persisted,/'romOutdoorAlignment'/);
});

test('global 78-border atlas is calculated once per ROM and is never persisted as current RAM',()=>{
 assert.match(source,/require\('\.\/romOutdoorOverlapIndex'\)/);
 assert.match(source,/this\._outdoorOverlapIndex=buildOutdoorOverlapIndex\(\{/);
 assert.match(source,/this\._outdoorOverlapSha!==sha/);
 assert.match(source,/outdoorOverlapIndex:this\.latestState\.romOutdoorOverlapIndex/);
 const persisted=method('persistState','loadPersistedActionHistory');
 assert.match(persisted,/'romOutdoorOverlapIndex'/);
 const invalidate=method('invalidateWorldEvidence','loadPersistedState');
 assert.match(invalidate,/romOutdoorOverlapIndex=\{verified:false/);
});

test('cycle fallback uses the unresolved target even when another batch route is found',()=>{
 const start=source.indexOf('    const detourTarget=detourTargets.find(');
 const end=source.indexOf('    this.latestState.globalCampaignLedger=buildCampaignLedger(',start);
 assert.ok(start>=0&&end>start,'Unresolved target must be explicitly bound');
 const selection=source.slice(start,end);
 const choose=(targets,results)=>{
  const fn=vm.runInNewContext('(function(detourTargets){'+selection+
   '\nreturn detourTarget;})');
  return fn.call({latestState:{romCrossMapItemRoutes:{results}}},targets);
 };
 const list=[{x:1,y:2},{x:9,y:7},{x:3,y:5}];
 assert.equal(choose(list,[{found:true},{found:false},{found:false}]).x,9);
 assert.equal(choose(list,[{found:true},{found:true},{found:true}]),null);
 assert.equal(choose(list,[]).x,1);
 assert.match(source,/if\(detourTarget&&this\.latestState\.romLocalExitAccess\?\.verified===true\)\{/);
 assert.doesNotMatch(source,/if\(detourTarget&&this\.latestState\.romLocalExitAccess\?\.verified===true&&/);
});

test('Strength planner uses badge+move, confirmed sprites and never claims active Strength',()=>{
 assert.match(source,/require\('\.\/romStrengthPushPlanner'\)/);
 assert.match(source,/knowsMove\(46,'STRENGTH'\)/);
 assert.match(source,/rainbow/i);
 assert.match(source,/planStrengthPushes\(\{/);
 assert.match(source,/spritesVerified:verifiedSprites/);
 assert.match(source,/Strength ativado e empurrões reais NÃO comprovados/);
});

test('Strength missing capacity is classified blocked, theoretical push is conditional',()=>{
 // Execute the real consumer guard and projection together: never evaluate
 // withPath in isolation after its ROM/map/RAM scope was introduced.
 const a=source.indexOf('    const accessSummary=Array.isArray(itemAccess?.results)?');
 const b=source.indexOf('    const visibleWithPath=',a);
 assert.ok(a>=0&&b>a,'ROM-verified projection scope must be included');
 const block=source.slice(a,b);
 const generate=vm.runInNewContext('(function(itemAccess,accessInput){'+block+
   '\nreturn withPath;})');
 const kinds=['NEEDS_STRENGTH','STRENGTH_SEQUENCE_HYPOTHESIS',
   'STRENGTH_CAPABILITY_UNKNOWN','NEEDS_SURF','NO_SAME_MAP_PATH'];
 const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
 const items=kinds.map((name,index)=>({
   name,x:index,y:1,romItemCoordinatesVerified:true
 }));
 const rows=kinds.map((accessStatus,index)=>({
   index,x:index,y:1,accessStatus,reason:'Unverified ability'
 }));
 const client={activeRomProfile:{hash:{sha256:sha}},
   latestState:{mapId:15,romRuntimeIdentity:{matched:true},
     memoryReadStatus:{verified:true}}};
 const planner={verified:true,mapId:15,romSha256:sha,results:rows};
 const out=generate.call(client,planner,items);
 assert.deepEqual(Array.from(out,x=>x.isLocked),[true,false,false,true,false]);
 assert.equal(out[0].accessStatus,'NEEDS_STRENGTH');
 assert.equal(out[1].accessStatus,'STRENGTH_SEQUENCE_HYPOTHESIS');
 assert.equal(out[0].accessibleNow,null);
 assert.equal(out[1].accessibleNow,null);
 // An index disagreement must never transfer a strength blockade.
 const swapped={...planner,results:rows.map(r=>({...r}))};
 swapped.results[0].index=1;
 const stale=generate.call(client,swapped,items);
 assert.equal(stale[0].accessStatus,'UNKNOWN');
 assert.equal(stale[0].isLocked,false);
 assert.equal(stale[0].accessRoute,null);
});

test('global detours also inspect ROM items blocked by Cut Surf and Strength',()=>{
 const start=source.indexOf('    const detourTriggerStatuses=new Set([');
 const end=source.indexOf('    if(detourTargets.length&&',start);
 assert.ok(start>=0&&end>start);
 const block=source.slice(start,end);
 const fn=vm.runInNewContext('(function(withPath){'+block+
   '\nreturn detourTargets.map(x=>x.accessStatus);})');
 const statuses=[
  'NO_SAME_MAP_PATH','NEEDS_CUT','NEEDS_SURF',
  'CUT_CAPABILITY_UNKNOWN','SURF_CAPABILITY_UNKNOWN',
  'NEEDS_CUT_AND_SURF_POSSIBLY','POSSIBLE_STRENGTH_BARRIER',
  'NEEDS_STRENGTH','STRENGTH_CAPABILITY_UNKNOWN',
  'STRENGTH_SEQUENCE_HYPOTHESIS','CONDITIONAL_PATH','COLLECTED_FLAG'
 ];
 const all=statuses.map((accessStatus,i)=>({
   x:i,y:0,romItemCoordinatesVerified:true,
   isCollected:accessStatus==='COLLECTED_FLAG',accessStatus
 }));
 assert.deepEqual(Array.from(fn(all)),statuses.slice(0,10));
 const unverified=all.map((r,i)=>({...r,romItemCoordinatesVerified:i!==1}));
 assert.equal(fn(unverified).includes('NEEDS_CUT'),false);
});

test('Strength memoization is scoped to position abilities and RAM sprites',()=>{
 const invalidation=method('invalidateWorldEvidence','loadPersistedState');
 assert.match(invalidation,/this\._strengthPlanCacheScope=null/);
 assert.match(invalidation,/this\._strengthPlanCache=new Map\(\)/);
 const persisted=method('persistState','loadPersistedActionHistory');
 assert.doesNotMatch(persisted,/_strengthPlanCache/);
 assert.match(source,/this\._strengthPlanCacheScope!==strengthScope/);
 assert.match(source,/this\._strengthPlanCache\.get\(strengthKey\)/);
 assert.match(source,/this\._strengthPlanCache\.size>=64/);
 assert.match(source,/entry\.route=\{steps:strength\.steps,nextStep:null/);
});

test('Strength D728 is decoded from existing world RAM and excluded from persistence',()=>{
 assert.match(source,/require\('\.\/romStrengthFieldEvidence'\)/);
 assert.match(source,/worldBlockHex:blockWorldEvents/);
 assert.match(source,/mapWindowVerified:mapConfirmation\.verified===true/);
 assert.match(source,/positionWindowVerified:positionWindow\.verified===true/);
 assert.match(source,/strengthFieldActiveAtSample:strengthFlag\.verified===true/);
 assert.match(method('persistState','loadPersistedActionHistory'),
   /'romStrengthFieldEvidence'/);
 assert.match(method('invalidateWorldEvidence','loadPersistedState'),
   /romStrengthFieldEvidence=\{verified:false,activeAtSample:null/);
});

test('world return cycles never falsely call conditional Cut/Surf/Strength an absent path',()=>{
 assert.match(source,/localPathAbsent:detourTarget\.accessStatus==='NO_SAME_MAP_PATH'/);
 assert.match(source,/localPathConditional:detourTarget\.accessStatus!=='NO_SAME_MAP_PATH'/);
 assert.match(source,/detourTarget\.x,detourTarget\.y,detourTarget\.accessStatus/);
});

test('Strength route requires matching variant SHA; changes to terrain fingerprints invalidate memoization',()=>{
 const a=source.indexOf('    const verifiedSprites=this.latestState.memoryReadStatus?.blocks?.overworldSprites===true;');
 const b=source.indexOf('    this.latestState.romItemAccess=itemAccess;',a);
 assert.ok(a>=0&&b>a);
 const live=source.slice(a,b);
 assert.match(live,/strengthVariantVerified/);
 assert.match(live,/romVariantTerrainEvidence\?\.romSha256===/);
 assert.match(live,/strengthTerrain\?\.tileIdsSha256/);
 assert.match(live,/strengthTerrain\?\.walkingBitsSha256/);
 assert.match(live,/if\(strengthVariantVerified&&itemAccess\.verified===true&&verifiedSprites\)/);
 const execute=vm.runInNewContext('(function(itemAccess,accessInput,abilityStrength,positionWindow,modeWindow,planStrengthPushes,strengthFlag){'+live+'\nreturn itemAccess;})');
 const terrain={verified:true,tileIdsSha256:'A',walkingBitsSha256:'B'};
 const context={activeRomProfile:{hash:{sha256:'a'.repeat(64)}},latestState:{
   mapId:21,coords:{x:1,y:1},memoryReadStatus:{blocks:{overworldSprites:true}},
   romVariantTerrainEvidence:{verified:true,romSha256:'a'.repeat(64)},
   romStaticMapGuide:{terrain},mapEntities:[{x:2,y:1,type:'boulder',pictureId:63}]
 }};
 const input=[{x:5,y:1,romItemCoordinatesVerified:true}];
 let calls=0,currentModeByte=0;
 const sampledModes=[];
 const compute=({modeByte})=>{calls++;sampledModes.push(modeByte);return {
   verified:true,found:true,pushCount:1,
   steps:2,pushes:[{direction:'east',from:{x:2,y:1},to:{x:3,y:1}}]}};
 const invoke=()=>execute.call(context,{verified:true,results:[{index:0,
   accessStatus:'POSSIBLE_STRENGTH_BARRIER'}]},input,true,
   {verified:true},{verified:true,modeByte:currentModeByte},
   compute,{verified:true,activeAtSample:true});
 invoke();invoke();assert.equal(calls,1);
 terrain.tileIdsSha256='C';invoke();assert.equal(calls,2);
 // A change from walking to bicycle must invalidate the memoized plan.
 currentModeByte=1;invoke();assert.equal(calls,3);
 assert.deepEqual(sampledModes,[0,0,1]);
 context.latestState.romVariantTerrainEvidence.verified=false;
 const refused=invoke();
 assert.equal(calls,3);
 assert.equal(refused.results[0].accessStatus,'POSSIBLE_STRENGTH_BARRIER');
});

test('remote pending flag items are routed once with verified ROM and RAM and never persisted',()=>{
 assert.match(source,/require\('\.\/romGlobalFlagItemRoutes'\)/);
 assert.match(source,/selectGlobalFlagTargets\(\{/);
 assert.match(source,/planGlobalFlagItemRoutes\(\{/);
 assert.match(source,/const remoteTerrainOK=this\.latestState\.romVariantTerrainEvidence\?\.verified===true/);
 assert.match(source,/maxTargets:4,maxStates:180,maxTransitions:10/);
 assert.match(source,/this\._globalFlagItemKey!==remoteKey/);
 assert.match(source,/this\.latestState\.globalFlagItemRoutes=this\._globalFlagItemRoutes/);
 assert.match(method('persistState','loadPersistedActionHistory'),/'globalFlagItemRoutes'/);
 assert.match(method('invalidateWorldEvidence','loadPersistedState'),
   /globalFlagItemRoutes=\{verified:false,items:\[\],reason\}/);
});

test('remote flags cache closes when warp graph or position window loses proof',()=>{
 const block=remoteRouteCacheBlock();
 assert.match(block,/remoteGraphOK/);
 assert.match(block,/remoteSearchReady/);
 assert.match(block,/this\._globalFlagItemRoutes=remoteSearchReady\?/);
 const fn=vm.runInNewContext('(function(mapConfirmation,positionWindow,modeWindow,abilityCut,abilitySurf,selectGlobalFlagTargets,planGlobalFlagItemRoutes){'+
   block+'\nreturn this.latestState.globalFlagItemRoutes;})');
 const context={activeRomProfile:{hash:{sha256:'sha'},world:{terrainAtlas:{verified:true}}},
   latestState:{mapId:15,coords:{x:1,y:1},
     romVariantTerrainEvidence:{verified:true,romSha256:'sha'},
     romWarpGraph:{verified:true,romSha256:'sha'},
     romOutdoorReferenceEvidence:{verified:true},
     romOutdoorAlignment:{verified:true},
     memoryReadStatus:{blocks:{overworldSprites:true}},mapEntities:[],
     globalCampaignLedger:{verified:true},globalCampaignObjectives:{verified:true}}};
 let calls=0;
 const select=()=>({verified:true,items:[{kind:'HIDDEN_ITEM',mapId:3,x:5,y:5,bitIndex:4}]});
 const route=()=>{calls++;return {verified:true,items:[],foundCount:0}};
 const run=(positionVerified=true)=>fn.call(context,{verified:true},{verified:positionVerified},
   {verified:true,modeByte:0},false,false,select,route);
 assert.equal(run().verified,true);assert.equal(run().verified,true);assert.equal(calls,1);
 context.latestState.romWarpGraph.verified=false;
 assert.equal(run().verified,false);assert.equal(calls,1);
 context.latestState.romWarpGraph.verified=true;
 assert.equal(run().verified,true);assert.equal(calls,2);
 assert.equal(run(false).verified,false);assert.equal(calls,2);
});

test('compact objective index covers 226 maps while detailed UI and BFS remain bounded',()=>{
 const text=source.slice(source.indexOf('    this.latestState.globalCampaignObjectives=campaignObjectives({'));
 assert.match(text,/maxResults:12/);
 assert.match(text,/sourceMapId:this\.latestState\.mapId,maxTargets:4/);
 assert.match(text,/maxTargets:4,maxStates:180,maxTransitions:10/);
});

test('remote route cache must update when static connectivity changes for same hidden tile',()=>{
 const actual=remoteRouteCacheBlock();
 assert.match(actual,/t\.bitIndex,t\.mapHopCount,t\.staticRouteKnown/);
 const execute=vm.runInNewContext(
   '(function(mapConfirmation,positionWindow,modeWindow,abilityCut,abilitySurf,'+
   'selectGlobalFlagTargets,planGlobalFlagItemRoutes){'+actual+
   '\nreturn this.latestState.globalFlagItemRoutes;})');
 const context={activeRomProfile:{hash:{sha256:'sha'},
     world:{terrainAtlas:{verified:true}}},
   latestState:{mapId:15,coords:{x:3,y:4},
     romVariantTerrainEvidence:{verified:true,romSha256:'sha'},
     romWarpGraph:{verified:true,romSha256:'sha'},
     romOutdoorReferenceEvidence:{verified:true},
     romOutdoorAlignment:{verified:true},
     memoryReadStatus:{blocks:{overworldSprites:true}},mapEntities:[],
     globalCampaignLedger:{verified:true},globalCampaignObjectives:{verified:true}}};
 let known=false,calls=0;
 const selected=()=>({verified:true,items:[{kind:'HIDDEN_ITEM',
   mapId:48,x:9,y:11,bitIndex:3,
   mapHopCount:known?2:null,staticRouteKnown:known}]});
 const route=()=>{calls++;return {verified:true,items:[],
   reason:known?'hypothesis':'unknown static graph'};};
 const read=()=>execute.call(context,{verified:true},{verified:true},
   {verified:true,modeByte:0},false,false,selected,route);
 assert.equal(read().reason,'unknown static graph');
 assert.equal(read().reason,'unknown static graph');
 assert.equal(calls,1);
 known=true;
 assert.equal(read().reason,'hypothesis');
 assert.equal(calls,2);
 known=false;
 assert.equal(read().reason,'unknown static graph');
 assert.equal(calls,3);
});

test('world objectives use small UI payload but remote selector reads compact full index',()=>{
 assert.match(source,/this\.latestState\.globalCampaignObjectives=campaignObjectives\(\{/);
 const start=source.indexOf('    this.latestState.globalCampaignObjectives=campaignObjectives({');
 assert.match(source.slice(start,start+650),/maxResults:12/);
 assert.match(source,/selectGlobalFlagTargets\(\{/);
});

test('all pending remote flags invalidate route cache, not only four selected tiles',()=>{
 const actual=remoteRouteCacheBlock();
 assert.match(actual,/remoteSelection\.pendingSignature\?\?null/);
 const execute=vm.runInNewContext('(function(mapConfirmation,positionWindow,modeWindow,'+
   'abilityCut,abilitySurf,selectGlobalFlagTargets,planGlobalFlagItemRoutes){'+
   actual+'\nreturn this.latestState.globalFlagItemRoutes;})');
 const context={activeRomProfile:{hash:{sha256:'sha'},world:{terrainAtlas:{}}},
  latestState:{mapId:15,coords:{x:2,y:3},
    romVariantTerrainEvidence:{verified:true,romSha256:'sha'},
    romWarpGraph:{verified:true,romSha256:'sha'},
    romOutdoorReferenceEvidence:{verified:true},
    romOutdoorAlignment:{verified:true},
    memoryReadStatus:{blocks:{overworldSprites:true}},mapEntities:[],
    globalCampaignLedger:{verified:true},globalCampaignObjectives:{verified:true}}};
 let signature='a',calls=0;
 const select=()=>({verified:true,pendingSignature:signature,
   items:[{kind:'HIDDEN_ITEM',mapId:3,x:1,y:2,bitIndex:0,
     mapHopCount:1,staticRouteKnown:true}]});
 const route=()=>{calls++;return {verified:true,items:[],count:calls};};
 const update=()=>execute.call(context,{verified:true},{verified:true},
   {verified:true,modeByte:0},false,false,select,route);
 assert.equal(update().count,1);
 assert.equal(update().count,1);assert.equal(calls,1);
 signature='b';assert.equal(update().count,2);assert.equal(calls,2);
});

test('remote-route VM fragment excludes async battle readback and includes memoization',()=>{
 const block=remoteRouteCacheBlock();
 assert.match(block,/selectGlobalFlagTargets\(\{/);
 assert.match(block,/this\.latestState\.globalFlagItemRoutes=this\._globalFlagItemRoutes/);
 assert.doesNotMatch(block,/collectScriptedBattleLiveReadback/);
 assert.doesNotMatch(block,/\bawait\b/);
 const vmFunction=vm.runInNewContext('(function(){'+block+'\n})');
 assert.equal(typeof vmFunction,'function');
});

test('scripted battle readback status is transient at both cache locations',()=>{
 const writes=[];
 const Agent=vm.runInNewContext('(class Agent {\n'+
   method('persistState','loadPersistedActionHistory')+'\n})',{
    fs:{writeFileSync:(p,s)=>writes.push({p,s})},
    require:name=>({join:(...items)=>items.join('/')}),
    __dirname:'/mock/app'
   });
 const client=new Agent();
 const verified={verified:true,scriptValue:2,status:'SCRIPT_BYTE_REPEATED_REFERENCE_ONLY',
   readOnlyReadCalls:2,gameProgressCertified:false};
 const state={connected:true,isSimulation:false,trainerName:'RED',
  areaInfo:{name:'S.S. Anne'},mapId:96,party:[{speciesId:1}],
  romScriptedBattleReadbackStatus:verified,
  memoryReadStatus:{blocks:{playerParty:true},scriptedBattleReadback:verified}};
 client.persistState(state);
 assert.equal(writes.length,2);
 assert.equal(writes[0].s,writes[1].s);
 for(const entry of writes){
  const data=JSON.parse(entry.s);
  assert.equal(Object.hasOwn(data,'romScriptedBattleReadbackStatus'),false);
  assert.equal(Object.hasOwn(data.memoryReadStatus,'scriptedBattleReadback'),false);
  assert.equal(data.memoryReadStatus.blocks.playerParty,true);
 }
 assert.equal(state.romScriptedBattleReadbackStatus.verified,true);
 assert.equal(state.memoryReadStatus.scriptedBattleReadback.verified,true);
});
test('loading legacy cache strips old script readback but preserves party history',()=>{
 const stale={verified:true,status:'SCRIPT_BYTE_REPEATED_REFERENCE_ONLY',
  scriptValue:4,gameProgressCertified:false};
 const original={connected:true,party:[{speciesId:25}],
  actionHistory:[{text:'OLD ACTION'}],
  romScriptedBattleReadbackStatus:stale,
  memoryReadStatus:{blocks:{playerParty:true},scriptedBattleReadback:stale}};
 const Agent=vm.runInNewContext('(class Agent {\n'+
   method('loadPersistedState','persistState')+'\n})',{
    fs:{existsSync:()=>true,readFileSync:()=>JSON.stringify(original)},
    require:()=>({join:(...s)=>s.join('/')}),
    __dirname:'/mock/app'
   });
 const loaded=new Agent().loadPersistedState();
 assert.equal(loaded.connected,false);
 assert.equal(loaded.party[0].speciesId,25);
 assert.equal(loaded.actionHistory[0].text,'OLD ACTION');
 assert.equal(Object.hasOwn(loaded,'romScriptedBattleReadbackStatus'),false);
 assert.equal(Object.hasOwn(loaded.memoryReadStatus,'scriptedBattleReadback'),false);
 assert.equal(loaded.memoryReadStatus.blocks.playerParty,true);
});
test('invalidating world evidence also invalidates nested script telemetry',()=>{
 const Agent=vm.runInNewContext('(class Agent {\n'+
   method('invalidateWorldEvidence','loadPersistedState')+'\n})');
 const client=new Agent();
 client.latestState={actionHistory:[{text:'PRESERVE'}],
  memoryReadStatus:{blocks:{playerParty:true},
   scriptedBattleReadback:{verified:true,scriptValue:2}}};
 client.invalidateWorldEvidence('MAP_CHANGED');
 const top=client.latestState.romScriptedBattleReadbackStatus;
 const nested=client.latestState.memoryReadStatus.scriptedBattleReadback;
 assert.equal(top.verified,false);
 assert.equal(top.status,'WORLD_EVIDENCE_INVALIDATED');
 assert.equal(top.reason,'MAP_CHANGED');
 assert.equal(nested.verified,false);
 assert.equal(nested.status,top.status);
 assert.equal(nested.readOnlyReadCalls,0);
 assert.equal(client.latestState.memoryReadStatus.blocks.playerParty,true);
 assert.equal(client.latestState.actionHistory[0].text,'PRESERVE');
});
test('world invalidation still works when optional memory diagnostics are absent',()=>{
 const Agent=vm.runInNewContext('(class Agent {\n'+
   method('invalidateWorldEvidence','loadPersistedState')+'\n})');
 const client=new Agent();client.latestState={};
 client.invalidateWorldEvidence('ROM_CHANGED');
 assert.equal(client.latestState.romScriptedBattleReadbackStatus.verified,false);
 assert.equal(client.latestState.memoryReadStatus,undefined);
});

test('scripted battle byte transitions never enter persisted cache or legacy recovery',()=>{
 const writes=[];
 const Agent=vm.runInNewContext('(class Agent {\n'+
   method('persistState','loadPersistedActionHistory')+'\n})',{
   fs:{writeFileSync:(p,s)=>writes.push(s)},
   require:()=>({join:(...x)=>x.join('/')}),
   __dirname:'/mock/app'});
 const input={connected:true,isSimulation:false,trainerName:'RED',
  areaInfo:{name:'S.S. Anne'},party:[{speciesId:1}],mapId:96,
  romScriptedBattleStateDelta:{verified:true,changes:[{fromScriptByte:1,toScriptByte:2}]},
  romRecentScriptedBattleStateChanges:{verified:true,events:[{mapId:96}]}};
 new Agent().persistState(input);
 assert.equal(writes.length,2);
 for(const value of writes){
  const r=JSON.parse(value);
  assert.equal(Object.hasOwn(r,'romScriptedBattleStateDelta'),false);
  assert.equal(Object.hasOwn(r,'romRecentScriptedBattleStateChanges'),false);
 }
 assert.equal(input.romScriptedBattleStateDelta.verified,true);
 const Legacy=vm.runInNewContext('(class Agent {\n'+
   method('loadPersistedState','persistState')+'\n})',{
    fs:{existsSync:()=>true,readFileSync:()=>JSON.stringify(input)},
    require:()=>({join:(...x)=>x.join('/')}),
    __dirname:'/mock/app'});
 const legacy=new Legacy().loadPersistedState();
 assert.equal(Object.hasOwn(legacy,'romScriptedBattleStateDelta'),false);
 assert.equal(Object.hasOwn(legacy,'romRecentScriptedBattleStateChanges'),false);
});
test('world invalidation clears battle byte history and session baseline',()=>{
 const Agent=vm.runInNewContext('(class Agent {\n'+
   method('invalidateWorldEvidence','loadPersistedState')+'\n})');
 const a=new Agent(),called=[];
 a.latestState={memoryReadStatus:{blocks:{playerParty:true}},
  romScriptedBattleStateDelta:{verified:true,changes:[{mapId:96}]},
  romRecentScriptedBattleStateChanges:{verified:true,events:[{mapId:96}]}};
 a._scriptedBattleStateSession={reset:r=>called.push(r)};
 a.invalidateWorldEvidence('MAP_CHANGED');
 assert.deepEqual(called,['MAP_CHANGED']);
 assert.equal(a.latestState.romScriptedBattleStateDelta.verified,false);
 assert.equal(a.latestState.romScriptedBattleStateDelta.changes.length,0);
 assert.equal(a.latestState.romRecentScriptedBattleStateChanges.verified,false);
 assert.equal(a.latestState.romRecentScriptedBattleStateChanges.events.length,0);
 assert.equal(a.latestState.memoryReadStatus.blocks.playerParty,true);
});
test('battle transition ingest occurs only after final publication position guard',()=>{
 const final=source.indexOf("    const publicationMapAndPosition=await this.readMemoryBlock('D35E',8);");
 const scope=source.indexOf("    const targetScopeStable=matchesTargetScope(this,pollTargetScope);",final);
 const guard=source.indexOf("    if(!targetScopeStable||publicationPositionWindow.verified!==true",scope);
 const ingester=source.indexOf("    const scriptedTransition=this._scriptedBattleStateSession.ingest({",final);
 const saving=source.indexOf("    this.persistState(this.latestState);",ingester);
 const emit=source.indexOf("    this.emit('update', this.latestState);",ingester);
 const sourceRead=source.indexOf("    const scriptedBattleTargetAtRead={host:this.ip,port:this.port};");
 const pollEntry=source.indexOf("    this._scriptedBattlePollSequence=(this._scriptedBattlePollSequence||0)+1;");
 assert.ok(sourceRead>=0&&sourceRead<final);
 assert.ok(pollEntry>=0&&pollEntry<sourceRead);
 assert.ok(final>0&&scope>final&&guard>scope&&ingester>guard&&saving>ingester&&emit>saving);
 const safety=source.slice(guard,ingester);
 assert.match(safety,/TARGET_SWITCH_DURING_POLL_REJECT_PUBLICATION/);
 assert.match(safety,/publicationPositionWindow\.mapId!==this\.latestState\.mapId/);
 assert.match(safety,/publicationPositionWindow\.x!==latePositionWindow\.x/);
 assert.match(safety,/this\.invalidateWorldEvidence\(why\)/);
 assert.match(safety,/\n      return;/);
 assert.match(source.slice(ingester,ingester+660),/publicationGuardVerified:scriptedTargetStillSame/);
 assert.match(source.slice(ingester,ingester+660),/pollSequence:this\._scriptedBattlePollSequence/);
});


test('cross-map cache rejects stale outdoor routes when ROM reference or alignment changes',()=>{
 const begin=source.indexOf('      const targets=detourTargets.slice(0,64).map(');
 const end=source.indexOf('      this.latestState.romCrossMapItemRoutes={...r,',begin);
 assert.ok(begin>=0&&end>begin,'Real cross-map cache block must be present');
 const live=source.slice(begin,end);
 assert.match(live,/outdoorRouteProof/);
 assert.match(live,/outdoorFingerprint/);
 assert.match(live,/outdoorAlignment:outdoorRouteProof\?/);
 const invoke=vm.runInNewContext(
  '(function(detourTargets,modeWindow,abilityCut,abilitySurf,positionWindow,findCrossMapItemPaths){'+
    live+'\nreturn this._crossMapRoute;})'
 );
 const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
 const edges=Array.from({length:78},(_,i)=>({
   sourceMapId:i,destinationMapId:i+1,direction:'east'}));
 const connections=edges.map(e=>({...e,offsetBlocks:0,
   descriptorPointerMatches:true,referenceOffsetCorroborated:true}));
 const graph={verified:true,romSha256:sha,totalWarpEntries:813,
   outdoorConnections:{verified:true,romSha256:sha,edgeCount:78,
     reciprocalConnections:78,edges}};
 const alignment={verified:true,romSha256:sha,verifiedConnections:78,
   descriptorPointerFormulaVerified:true,referenceOffsetCorroborated:true,
   connections};
 const context={activeRomProfile:{hash:{sha256:sha},
   world:{terrainAtlas:{verified:true,romSha256:sha}}},
   latestState:{mapId:15,coords:{x:1,y:2},mapEntities:[],
     memoryReadStatus:{blocks:{overworldSprites:true}},
     romWarpGraph:graph,romOutdoorAlignment:alignment,
     romOutdoorReferenceEvidence:{verified:true}}};
 let calls=0;const allowed=[];
 const route=arg=>{calls++;allowed.push(arg.outdoorAlignment===alignment);
   return {verified:true,romSha256:sha,results:[]};};
 const run=()=>invoke.call(context,[{x:6,y:2}],{verified:true,modeByte:0},
   false,false,{verified:true},route);
 run();run();assert.equal(calls,1);
 assert.deepEqual(allowed,[true]);
 context.latestState.romOutdoorReferenceEvidence.verified=false;
 run();run();assert.equal(calls,2);
 assert.deepEqual(allowed,[true,false]);
 context.latestState.romOutdoorReferenceEvidence.verified=true;
 run();assert.equal(calls,3);
 assert.deepEqual(allowed,[true,false,true]);
 // An edge can change while 'verified' stays true: stale cache is forbidden.
 connections[0].offsetBlocks=1;
 run();assert.equal(calls,4);
 // A graph can lose its outdoor connections while ROM/map stay unchanged.
 context.latestState.romWarpGraph.outdoorConnections=null;
 run();assert.equal(calls,5);
 assert.deepEqual(allowed,[true,false,true,true,false]);
 // An unchanged invalid graph should not trigger repeated computation.
 run();assert.equal(calls,5);
});


test('cross-map cache invalidates when an unchanged ROM switches validated static warp landing',()=>{
 const begin=source.indexOf('      const targets=detourTargets.slice(0,64).map(');
 const end=source.indexOf('      this.latestState.romCrossMapItemRoutes={...r,',begin);
 assert.ok(begin>=0&&end>begin);
 const live=source.slice(begin,end);
 assert.match(live,/staticWarpFingerprint/);
 const execute=vm.runInNewContext(
   '(function(detourTargets,modeWindow,abilityCut,abilitySurf,positionWindow,findCrossMapItemPaths){'+
   live+'\nreturn this._crossMapRoute;})');
 const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
 const warp={status:'STATIC_DESTINATION_WARP_VALIDATED',
   sourceMapId:15,sourceWarpIndex:0,x:1,y:1,destinationMapId:20,
   landing:{mapId:20,warpIndex:1,x:2,y:3}};
 const graph={verified:true,romSha256:sha,totalWarpEntries:813,
   normalMapHeaders:226,edges:[warp]};
 const client={activeRomProfile:{hash:{sha256:sha},
   world:{terrainAtlas:{verified:true,romSha256:sha}}},
   latestState:{mapId:15,coords:{x:1,y:2},mapEntities:[],
     memoryReadStatus:{blocks:{overworldSprites:true}},
     romWarpGraph:graph,
     romOutdoorReferenceEvidence:{verified:false},
     romOutdoorAlignment:{verified:false}}};
 let calls=0;
 const search=()=>{calls++;return {verified:true,results:[]};};
 const run=()=>execute.call(client,[{x:4,y:4}],
   {verified:true,modeByte:0},false,false,{verified:true},search);
 run();run();assert.equal(calls,1);
 warp.landing.x=3;
 run();assert.equal(calls,2);
 warp.status='LAST_MAP_RAM_REQUIRED';
 run();assert.equal(calls,3);
 warp.status='STATIC_DESTINATION_WARP_VALIDATED';
 run();assert.equal(calls,4);
 run();assert.equal(calls,4);
});

test('remote flag cache invalidates for changed static warps and withdraws stale outdoor proof',()=>{
 const block=remoteRouteCacheBlock();
 assert.match(block,/remoteStaticWarpFingerprint/);
 assert.match(block,/remoteOutdoorFingerprint/);
 assert.match(block,/outdoorAlignment:remoteOutdoorProof\?/);
 const execute=vm.runInNewContext(
   '(function(mapConfirmation,positionWindow,modeWindow,abilityCut,abilitySurf,'+
   'selectGlobalFlagTargets,planGlobalFlagItemRoutes){'+block+
   '\nreturn this.latestState.globalFlagItemRoutes;})'
 );
 const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
 const warp={status:'STATIC_DESTINATION_WARP_VALIDATED',
   sourceMapId:15,sourceWarpIndex:2,x:1,y:1,destinationMapId:19,
   landing:{mapId:19,warpIndex:0,x:2,y:2}};
 const outdoorEdges=Array.from({length:78},(_,i)=>({
   sourceMapId:i,destinationMapId:i+1,direction:'east'}));
 const aligned=outdoorEdges.map(e=>({...e,offsetBlocks:0,
   descriptorPointerMatches:true,referenceOffsetCorroborated:true}));
 const graph={verified:true,romSha256:sha,totalWarpEntries:813,
   normalMapHeaders:226,edges:[warp],
   outdoorConnections:{verified:true,romSha256:sha,edgeCount:78,
     reciprocalConnections:78,edges:outdoorEdges}};
 const alignment={verified:true,romSha256:sha,verifiedConnections:78,
   descriptorPointerFormulaVerified:true,referenceOffsetCorroborated:true,
   connections:aligned};
 const state={mapId:15,coords:{x:1,y:2},
   romVariantTerrainEvidence:{verified:true,romSha256:sha},
   romWarpGraph:graph,romOutdoorAlignment:alignment,
   romOutdoorReferenceEvidence:{verified:true},
   memoryReadStatus:{blocks:{overworldSprites:true}},mapEntities:[],
   globalCampaignLedger:{verified:true},globalCampaignObjectives:{verified:true}};
 const client={activeRomProfile:{hash:{sha256:sha},
   world:{terrainAtlas:{verified:true}}},latestState:state};
 let calls=0;const alignedUsed=[];
 const select=()=>({verified:true,pendingSignature:'stable',
   items:[{kind:'HIDDEN_ITEM',mapId:19,x:2,y:2,bitIndex:1,
     mapHopCount:1,staticRouteKnown:true}]});
 const route=args=>{calls++;alignedUsed.push(args.outdoorAlignment===alignment);
   return {verified:true,items:[],foundCount:0};};
 const run=()=>execute.call(client,{verified:true},{verified:true},
   {verified:true,modeByte:0},false,false,select,route);
 run();run();assert.equal(calls,1);
 assert.deepEqual(alignedUsed,[true]);
 warp.landing.y=3;
 run();assert.equal(calls,2);
 state.romOutdoorReferenceEvidence.verified=false;
 run();assert.equal(calls,3);
 assert.deepEqual(alignedUsed,[true,true,false]);
 state.romOutdoorReferenceEvidence.verified=true;
 run();assert.equal(calls,4);
 aligned[0].offsetBlocks=1;
 run();assert.equal(calls,5);
 graph.outdoorConnections=null;
 run();assert.equal(calls,6);
 assert.deepEqual(alignedUsed,[true,true,false,true,true,false]);
 run();assert.equal(calls,6);
});
