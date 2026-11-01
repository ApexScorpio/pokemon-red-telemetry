'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {interpretHandler,interpretWorld,resolveSemantics,requirementsForSemantics}=require('../romScriptSemantics');
const {buildMapChecklist}=require('../romWorldChecklist');
const {buildWorldContentsIndex}=require('../romWorldContentsIndex');
const {adviseWorld}=require('../romWorldStateAdvisor');
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',at=0x18020;
function fixture(){
 const rom=Buffer.alloc(1048576);rom[0x147]=0x13;rom[0x148]=5;
 rom.set([8,0xf0,0xb8,0xea,0,0x20,0xc9],at);
 const data=Array.from({length:248},(_,mapId)=>({mapId,valid:mapId<226,objects:{objects:mapId<226?[{kind:'npc',x:2,y:3,spriteId:1,textId:1}]:[],signs:[],warps:[]}}));
 const references=data.filter(m=>m.valid).map(m=>({mapId:m.mapId,kind:'NPC',ordinal:1,x:2,y:3,rawTextId:1,scriptFileOffset:at,textPointerVerified:true,scriptCommand:'TX_START_ASM'}));
 const atlas={verified:true,romSha256:sha,references,maps:data.map(m=>({mapId:m.mapId,verified:m.valid,interactions:references.filter(r=>r.mapId===m.mapId)}))};
 atlas.scriptSemantics=JSON.parse(JSON.stringify(interpretWorld({rom,atlas})));
 const profile={hash:{sha256:sha},world:{maps:{valid:true,validMapHeaders:226,data},interactionScriptAtlas:atlas}};
 return {rom,atlas,profile,index:buildWorldContentsIndex(profile)};
}
test('missing byte retains exact ROM bank requirement and shared handler after compact JSON roundtrip',()=>{
 const {atlas}=fixture(),world=atlas.scriptSemantics;
 const h=resolveSemantics(world,world.rows[0]);
 assert.ok(world.rows.every(r=>resolveSemantics(world,r)===h));
 const [r]=requirementsForSemantics(h);
 assert.equal(r.sourceAddress,0xffb8);assert.equal(r.width,1);
 assert.equal(r.handlerOffset,at);assert.equal(r.instructionOffset,at+3);
 assert.equal(r.bankRegisterAddress,0x2000);assert.equal(r.controller,'MBC3');
 assert.equal(r.status,'UNKNOWN');assert.equal(r.observedRam,null);
 assert.equal(r.selectedBank,null);assert.equal(r.observedExecution,false);assert.equal(r.eventCompleted,null);
 assert.equal(r.physicalCandidateCount,63);assert.equal(r.possibleBanks.length,8);assert.equal(r.candidatesBounded,true);
 assert.deepEqual(r.conditions,[]);assert.ok(r.limitations.includes('HANDLER_INVOKED'));
});
test('all 226 applicable maps use universal checklist and advisor; arbitrary snapshot bytes never resolve banks',()=>{
 const {atlas,profile,index}=fixture();
 for(let mapId=0;mapId<226;mapId++){
  const action=buildMapChecklist({index,mapId,scriptAtlas:atlas,eventBitmap:{verified:true,romSha256:sha,mapId:mapId+1,provenance:'untrusted',bytes:{65464:2}}}).actions[0];
  assert.equal(action.scriptRuntimeRequirements[0].status,'UNKNOWN');
  assert.equal(action.completedNow,null);assert.equal(action.progress,'NOT_PROVEN');
  const advice=adviseWorld({profile,mapId,position:{x:1,y:1},positionVerified:true});
  const o=advice.observations.find(o=>o.status==='SCRIPT_RUNTIME_RAM_REQUIRED');
  assert.ok(o);assert.equal(o.runtimeRequirements[0].selectedBank,null);assert.equal(o.eventCompleted,null);
 }
 atlas.scriptSemantics.romSha256='invalid';
 assert.deepEqual(buildMapChecklist({index,mapId:0,scriptAtlas:atlas}).actions[0].scriptRuntimeRequirements,[]);
});
test('requirements survive diagnostic sample truncation',()=>{
 const {packHandlers,unpackHandlers}=require('../romScriptSemantics');
 const {rom}=fixture(),h=interpretHandler({rom,fileOffset:at});
 h.unresolved=Array.from({length:10},(_,offset)=>({offset,reason:'OTHER',conditions:[]}));
 const [loaded]=unpackHandlers(JSON.parse(JSON.stringify(packHandlers([h]))));
 assert.equal(loaded.unresolved.length,4);assert.deepEqual(loaded.runtimeRequirements,h.runtimeRequirements);
});
test('SHA, map, provenance and validation claims cannot manufacture an authenticated HRAM observation',()=>{
 const {rom}=fixture(),h=interpretHandler({rom,fileOffset:at});
 for(const snapshot of [undefined,
  {verified:true,romSha256:'wrong',mapId:0,source:'RetroArch READ_CORE_MEMORY'},
  {verified:true,romSha256:sha,mapId:1,source:'RetroArch READ_CORE_MEMORY'},
  {verified:true,romSha256:sha,mapId:0,source:'untrusted'},
  {verified:false,romSha256:sha,mapId:0}]){
  const [r]=requirementsForSemantics(h,{...snapshot,bytes:{65464:2}});
  assert.equal(r.status,'UNKNOWN');assert.equal(r.observedRam,null);
  assert.equal(r.selectedBank,null);assert.equal(r.eventCompleted,null);
 }
});
test('another proven RAM source retains original branch conditions and physical candidate bounds',()=>{
 const {rom}=fixture();
 rom.set([8,0xfa,0x23,0xc1,0xfe,2,0x28,4,0xea,0,0x30,0xc9,0xc9],at);
 const h=interpretHandler({rom,fileOffset:at}),[r]=requirementsForSemantics(h);
 assert.equal(r.sourceAddress,0xc123);assert.equal(r.bankRegisterAddress,0x3000);
 assert.equal(r.conditions.length,1);assert.equal(r.conditions[0].instructionOffset,at+6);
 assert.equal(r.conditions[0].taken,false);
 assert.deepEqual(r.conditions[0].predicate,{equals:[{read:0xc123},2]});
 // Byte 130 still selects bank 2: the MBC3 ignores bit seven.
 assert.ok(r.possibleBanks.includes(2));assert.equal(r.status,'UNKNOWN');
});
for(const variant of ['RED','BLUE','GREEN'])test('actual '+variant+' ROM preserves exactly two static effects',{skip:!process.env['POKEMON_'+variant+'_ROM']},()=>{
 const {readRom}=require('../romComprehensiveAudit');
 const {inspectRomBuffer}=require('../romVariantRegistry');
 const rom=readRom(process.env['POKEMON_'+variant+'_ROM']);
 const p=inspectRomBuffer(rom,variant.toLowerCase()+'.gb'),w=p.world.interactionScriptAtlas.scriptSemantics;
 const {AUDITED_ROM_SHA256}=require('../romKnownSha256');
 assert.equal(p.hash.sha256,AUDITED_ROM_SHA256[variant==='GREEN'?'GREEN_INTERNATIONAL_1_2_1':variant]);
 assert.equal(w.formallyProvenScriptEffects,2);
 for(const [handler,instruction,address] of [[0x1cab8,0x1cabe,0xd7bf],[0x514a4,0x514a8,0xd7f0]]){
  const h=interpretHandler({rom,fileOffset:handler});
  assert.ok(h.effects.some(e=>e.instructionOffset===instruction&&e.address===address&&e.gameplayStateTransitionProven&&e.observedExecution===false));
 }
 assert.equal(JSON.parse(JSON.stringify(w)).formallyProvenScriptEffects,2);
});
