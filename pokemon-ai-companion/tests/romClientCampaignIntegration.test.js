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
 assert.match(source,/this\._worldCampaignSession\.ingest\(/);
 assert.doesNotMatch(source,/previousGlobalLedger=this\.latestState\.globalCampaignLedger/);
});

test('world reference and elevator adapters are imported, refreshed and invalidated',()=>{
 assert.match(source,/require\('\.\/romWorldReferenceSession'\)/);
 assert.match(source,/require\('\.\/romElevatorChoices'\)/);
 assert.match(source,/this\._worldReferenceSession\.ingest\(/);
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
 const a=source.indexOf('    const withPath=accessInput.map(');
 const b=source.indexOf('    const visibleWithPath=',a);
 assert.ok(a>=0&&b>a);
 const block=source.slice(a,b);
 const generate=vm.runInNewContext('(function(accessInput,accessSummary){'+block+
   '\nreturn withPath;})');
 const kinds=['NEEDS_STRENGTH','STRENGTH_SEQUENCE_HYPOTHESIS',
   'STRENGTH_CAPABILITY_UNKNOWN','NEEDS_SURF','NO_SAME_MAP_PATH'];
 const items=kinds.map((name,index)=>({name,x:index,y:1}));
 const rows=kinds.map(accessStatus=>({accessStatus,reason:'Unverified ability'}));
 const out=generate(items,rows);
 assert.deepEqual(Array.from(out,x=>x.isLocked),[true,false,false,true,false]);
 assert.equal(out[0].accessibleNow,null);
 assert.equal(out[1].accessibleNow,null);
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
