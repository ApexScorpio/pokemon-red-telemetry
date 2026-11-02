'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {projectScriptCoverage,blockerCategory}=require('../romScriptBlockerCoverage');
const {packHandlers,unpackHandlers,resolveSemantics,interpretHandler}=require('../romScriptSemantics');
const {buildMapChecklist}=require('../romWorldChecklist');
const {buildWorldContentsIndex}=require('../romWorldContentsIndex');
const {adviseWorld}=require('../romWorldStateAdvisor');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../public/app.js'),'utf8');
const start=source.indexOf('function formatCampaignChecklistSection(');
const end=source.indexOf('function renderWorldAdvisor(',start);
const format=vm.runInNewContext(source.slice(start,end)+'\nformatCampaignChecklistSection;');
test('exact counts, conservative categories, bounded samples and physical pending PC survive DAG JSON',()=>{
 const rom=Buffer.alloc(1048576),at=0x18020;rom.set([8,0,0xc9],at);
 const pending=interpretHandler({rom,fileOffset:at,maxSteps:1});
 assert.equal(pending.unresolved[0].offset,at+2);
 const unresolved=Array.from({length:19},(_,i)=>({offset:at+i,reason:i%2?'PATH_BUDGET':'STEP_BUDGET'}));
 const original={verified:true,handlerOffset:at,unresolved,effects:[],complete:false};
 const [h]=unpackHandlers(JSON.parse(JSON.stringify(packHandlers([original]))));
 assert.equal(h.unresolvedCount,19);assert.deepEqual(h.unresolvedReasonCounts,{STEP_BUDGET:10,PATH_BUDGET:9});
 assert.equal(h.unresolvedSamplesBounded,true);assert.equal(h.unresolved.length,4);
 assert.deepEqual(unpackHandlers(packHandlers([h]))[0],h);
 assert.equal(blockerCategory('unexpected new diagnostic'),'OTHER');
 assert.equal(blockerCategory('HALT_REQUIRES_INTERRUPT_STATE'),'OTHER');
 for(const [reason,category] of [['INDIRECT_TARGET_UNKNOWN','INDIRECT_TARGET'],['INDIRECT_MEMORY_UNKNOWN','UNKNOWN_MEMORY'],['UNSUPPORTED_OPCODE_f3','UNSUPPORTED_OPCODE'],['LOOP_REQUIRES_FIXPOINT','LOOP_REQUIRES_FIXPOINT'],['ROM_BANK_OR_TARGET_UNKNOWN','UNKNOWN_BANK']])assert.equal(blockerCategory(reason),category);
});
for(const variant of ['RED','BLUE','GREEN'])test('real '+variant+' worldwide physical blockers, shared identities, SHA guard and current UI',
 {skip:!process.env['POKEMON_'+variant+'_ROM']},()=>{
 const {readRom}=require('../romComprehensiveAudit');
 const {inspectRomBuffer}=require('../romVariantRegistry');
 const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
 const rom=readRom(process.env['POKEMON_'+variant+'_ROM']);
 const p=inspectRomBuffer(rom,variant.toLowerCase()+'.gb'),atlas=p.world.interactionScriptAtlas;
 const sha=p.hash.sha256,w=atlas.scriptSemantics;
 assert.equal(sha,AUDITED_ROM_SHA256[variant==='GREEN'?'GREEN_INTERNATIONAL_1_2_1':variant]);
 const refs=atlas.maps.flatMap(m=>m.interactions);
 assert.equal(refs.length,1126);assert.equal(w.rows.length,1126);
 assert.equal(new Set(w.rows.filter(r=>r.handlerOffset!==null).map(r=>r.handlerOffset)).size,516);
 assert.equal(refs.filter(r=>r.scriptCommand==='TX_START_ASM').length,626);
 const loaded=JSON.parse(JSON.stringify(atlas)),index=buildWorldContentsIndex(p);
 const histogram={},categoryHistogram={},frontiers={STEP_BUDGET:[],PATH_BUDGET:[]},byHandler=new Map();
 let asm=0,text=0,total=0;
 for(const r of refs){
  const c=projectScriptCoverage({atlas:loaded,romSha256:sha,reference:r});assert.ok(c);
  assert.equal(c.completedNow,null);assert.equal(c.accessibleNow,null);assert.equal(c.fullScriptCertified,false);
  const row=w.rows.find(s=>s.mapId===r.mapId&&s.kind===r.kind&&s.ordinal===r.ordinal);
  if(r.scriptCommand!=='TX_START_ASM'){text++;assert.equal(c.handlerOffset,null);assert.equal(c.executableAsm,false);continue;}
  asm++;const h=resolveSemantics(w,row);
  assert.equal(c.handlerOffset,r.scriptFileOffset);assert.equal(c.unresolvedCount,h.unresolved.length);
  const exact={},categories={};for(const u of h.unresolved){
   exact[u.reason]=(exact[u.reason]||0)+1;
   const category=blockerCategory(u.reason,u);categories[category]=(categories[category]||0)+1;
   assert.ok(Number.isInteger(u.offset)&&u.offset>=0&&u.offset<rom.length);
  }
  assert.deepEqual(c.unresolvedReasonCounts,exact);
  assert.deepEqual(c.unresolvedCategoryCounts,categories);
  assert.equal(Object.values(c.unresolvedCategoryCounts).reduce((a,b)=>a+b,0),c.unresolvedCount);
  assert.equal(c.unresolvedSamplesBounded,h.unresolved.length>4);
  for(const u of c.unresolvedSamples){assert.equal(u.handlerOffset,r.scriptFileOffset);assert.ok(Number.isInteger(u.instructionOffset));assert.ok(u.instructionOffset>=0&&u.instructionOffset<rom.length);}
  if(!byHandler.has(c.handlerOffset)){
   byHandler.set(c.handlerOffset,[]);total+=c.unresolvedCount;
   for(const [reason,n] of Object.entries(exact))histogram[reason]=(histogram[reason]||0)+n;
   for(const [category,n] of Object.entries(categories))categoryHistogram[category]=(categoryHistogram[category]||0)+n;
   for(const u of h.unresolved)if(frontiers[u.reason]?.length<5)frontiers[u.reason].push({handler:c.handlerOffset,offset:u.offset,bytes:rom.subarray(u.offset,u.offset+8).toString('hex'),conditions:u.conditions.length});
  }
  byHandler.get(c.handlerOffset).push(r);
 }
 assert.equal(asm,626);assert.equal(text,500);
 let mappedReferences=0;
 for(let mapId=0;mapId<248;mapId++){
  const checklist=buildMapChecklist({index,mapId,scriptAtlas:loaded});
  for(const action of checklist.actions){
   assert.equal(action.completedNow,null);assert.equal(action.accessibleNow,null);
   if(!action.scriptReferenceBound)continue;
   mappedReferences++;assert.ok(action.scriptCoverage);
   assert.equal(action.scriptCoverage.mapId,mapId);
   assert.equal(action.scriptCoverage.kind,action.kind);
   assert.equal(action.scriptCoverage.ordinal,action.ordinal);
  }
 }
 assert.equal(mappedReferences,1126);
 const shared=[...byHandler.values()].find(rs=>new Set(rs.map(r=>r.mapId)).size>1);assert.ok(shared);
 for(const r of shared){const action=buildMapChecklist({index,mapId:r.mapId,scriptAtlas:loaded}).actions.find(a=>a.kind===r.kind&&a.ordinal===r.ordinal);assert.ok(action?.scriptCoverage);assert.equal(action.scriptCoverage.mapId,r.mapId);assert.equal(action.scriptCoverage.handlerOffset,shared[0].scriptFileOffset);}
 const boundedRef=refs.find(r=>projectScriptCoverage({atlas:loaded,romSha256:sha,reference:r})?.unresolvedSamplesBounded);
 assert.ok(boundedRef);
 const mapIds=[...new Set([boundedRef.mapId,...refs.filter(r=>r.scriptCommand==='TX_START_ASM').map(r=>r.mapId)])].slice(0,4);
 for(const mapId of mapIds){
  const advice=adviseWorld({profile:p,mapId});
  assert.ok(advice.observations.some(o=>o.status==='SCRIPT_COVERAGE'));
  const output=format(advice,{romRuntimeIdentity:{matched:true,profileSha256:sha}}).join('\n');
  assert.match(output,/STATIC_ROM_EVIDENCE: handler ROM 0x/);assert.match(output,/caminhos não resolvidos/);assert.match(output,/script integral não certificado/);
  if(mapId===boundedRef.mapId)assert.match(output,/amostra limitada/);
  assert.ok(advice.mapChecklist.actions.every(a=>a.completedNow===null&&a.accessibleNow===null));
  assert.doesNotMatch(format(advice,{romRuntimeIdentity:{matched:true,profileSha256:'foreign'}}).join('\n'),/STATIC_ROM_EVIDENCE: handler/);
 }
 loaded.scriptSemantics.romSha256='foreign';
 assert.equal(projectScriptCoverage({atlas:loaded,romSha256:sha,reference:refs[0]}),null);
 assert.ok(buildMapChecklist({index,mapId:mapIds[0],scriptAtlas:loaded}).actions.every(a=>a.scriptCoverage===null));
 assert.equal(w.formallyProvenScriptEffects,2);
 console.log(JSON.stringify({variant,sha,sourceReferences:refs.length,asmReferences:asm,physicalHandlers:byHandler.size,unresolvedPhysicalPaths:total,histogram,categoryHistogram,frontiers,effects:w.formallyProvenScriptEffects}));
});
