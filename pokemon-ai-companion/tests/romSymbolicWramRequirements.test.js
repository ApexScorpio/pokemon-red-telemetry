'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const {interpretHandler}=require('../romScriptSemantics');
const {
 groupMapRootSymbolicWriteRequirements
}=require('../romMapScriptRootSemantics');
const {readRom,KNOWN}=require('../romComprehensiveAudit');

const SIGNATURE=Buffer.from(
 '21e8c6fa69d3c6065f16001919191e03195f78a72804190520fc09fa9fd077',
 'hex'
);

function fixture(valid=true){
 const rom=Buffer.alloc(1048576);

 rom.set([
  0x06,0x02,
  0x0e,0x03
 ],0xee9d);

 rom.set(SIGNATURE,0xeea1);

 if(!valid){
  rom[0xeeaf]=0x00;
 }

 return rom;
}

test('synthetic symbolic WRAM write is bounded but not executed',()=>{
 const result=interpretHandler({
  rom:fixture(),
  fileOffset:0xee9d,
  entryKind:'MAP_SCRIPT_ROOT',
  maxSteps:256,
  maxPaths:16
 });

 assert.equal(result.verified,true);
 assert.equal(result.observedExecution,false);
 assert.equal(result.eventCompleted,null);

 const unknown=result.unresolved.filter(
  u=>u.reason==='UNRESOLVED_MEMORY_OR_BANK_WRITE'
 );

 assert.equal(unknown.length,1);

 assert.equal(result.symbolicWriteRequirements.length,1);

 const r=result.symbolicWriteRequirements[0];

 assert.equal(r.sourceAddress,0xd369);
 assert.equal(r.instructionOffset,0xeebf);
 assert.equal(r.loopIterations,2);
 assert.equal(r.symbolicMultiplier,5);
 assert.equal(r.finalBC,3);
 assert.equal(r.candidateCount,256);
 assert.equal(r.candidateMin,0xc6ee);
 assert.equal(r.candidateMax,0xcbe9);
 assert.equal(r.memoryRegion,'WRAM');
 assert.equal(r.runtimeRamReadObserved,false);
 assert.equal(r.targetAddressObserved,false);
 assert.equal(r.memoryWriteObserved,false);
 assert.equal(r.gameplayExecutionObserved,false);
 assert.equal(r.gameEventCompleted,false);
});

test('changed ROM instruction pattern cannot invent WRAM proof',()=>{
 const result=interpretHandler({
  rom:fixture(false),
  fileOffset:0xee9d,
  entryKind:'MAP_SCRIPT_ROOT',
  maxSteps:256,
  maxPaths:16
 });

 assert.equal(result.verified,true);
 assert.deepEqual(result.symbolicWriteRequirements,[]);
});

test('grouping retains conditional counts and rejects false evidence',()=>{
 const r={
  reason:'LIVE_RAM_REQUIRED_FOR_SYMBOLIC_WRAM_WRITE_TARGET',
  instructionOffset:0xeebf,
  sourceAddress:0xd369,
  sourceAddend:6,
  baseCpuAddress:0xc6e8,
  symbolicMultiplier:5,
  fixedAddend:3,
  loopIterations:2,
  finalBC:3,
  candidateCount:256,
  candidateMin:0xc6ee,
  candidateMax:0xcbe9,
  memoryRegion:'WRAM',
  targetValue:95,
  runtimeRamReadObserved:false,
  targetAddressObserved:false,
  memoryWriteObserved:false,
  gameplayExecutionObserved:false,
  gameEventCompleted:false
 };

 const groups=groupMapRootSymbolicWriteRequirements([
  r,
  {...r},
  {...r,loopIterations:3,symbolicMultiplier:6},
  {...r,memoryWriteObserved:true},
  {...r,candidateCount:255},
  {...r,candidateMax:0xffff},
  null
 ]);

 assert.equal(groups.length,2);

 assert.equal(
  groups.find(x=>x.loopIterations===2)
   .conditionalPathRequirements,
  2
 );

 assert.equal(
  groups.find(x=>x.loopIterations===3)
   .conditionalPathRequirements,
  1
 );

 assert.deepEqual(
  groupMapRootSymbolicWriteRequirements(null),
  []
 );
});

test('UI preserves ROM/map identity and execution guards',()=>{
 const catalogue=fs.readFileSync(
  path.join(__dirname,'..','romMapScriptRootSemantics.js'),
  'utf8'
 );

 const app=fs.readFileSync(
  path.join(__dirname,'..','public','app.js'),
  'utf8'
 );

 assert.ok(catalogue.includes(
  'runtimeSymbolicWriteRequirements'
 ));

 assert.ok(app.includes('mapRootT190.romSha256===runtimeSha'));
 assert.ok(app.includes('mapRootT190.mapId===advice.mapId'));
 assert.ok(app.includes('mapRootSymbolicT214'));
 assert.ok(app.includes('r.runtimeRamReadObserved===false'));
 assert.ok(app.includes('r.targetAddressObserved===false'));
 assert.ok(app.includes('r.memoryWriteObserved===false'));
 assert.ok(app.includes('r.gameplayExecutionObserved===false'));
 assert.ok(app.includes('r.gameEventCompleted===false'));
});

const inputs=[
 ['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],
 ['green','POKEMON_GREEN_ROM']
];

for(const [variant,env] of inputs){
 test('real ROM symbolic WRAM provenance: '+variant,{
  skip:!process.env[env]?
   'Original authenticated ROM unavailable':false
 },()=>{
  const rom=readRom(process.env[env]);

  assert.equal(
   crypto.createHash('sha256').update(rom).digest('hex'),
   KNOWN[variant]
  );

  for(const [mapId,offset,stops,expectedUnique] of [
   [210,106295,42,683],
   [212,334689,39,697]
  ]){
   const result=interpretHandler({
    rom,
    fileOffset:offset,
    entryKind:'MAP_SCRIPT_ROOT',
    maxSteps:8192,
    maxPaths:128
   });

   assert.equal(result.verified,true);
   assert.equal(result.observedExecution,false);
   assert.equal(result.eventCompleted,null);

   const unresolved=result.unresolved.filter(
    u=>u.reason==='UNRESOLVED_MEMORY_OR_BANK_WRITE'
   );

   assert.equal(unresolved.length,stops);
   assert.equal(
    result.symbolicWriteRequirements.length,
    stops
   );

   const groups=groupMapRootSymbolicWriteRequirements(
    result.symbolicWriteRequirements
   );

   assert.equal(groups.length,3);

   assert.equal(
    groups.reduce(
     (total,r)=>total+r.conditionalPathRequirements,0
    ),
    stops
   );

   const addresses=new Set();

   for(const r of result.symbolicWriteRequirements){
    assert.equal(r.sourceAddress,0xd369);
    assert.equal(r.instructionOffset,0xeebf);
    assert.equal(r.candidateCount,256);
    assert.equal(r.memoryRegion,'WRAM');
    assert.equal(r.memoryWriteObserved,false);
    assert.equal(r.gameEventCompleted,false);

    for(let byte=0;byte<256;byte++){
     const e=(byte+6)&255;

     const address=(
      0xc6e8+
      r.symbolicMultiplier*e+
      r.fixedAddend+
      r.finalBC
     )&65535;

     assert.ok(address>=0xc000&&address<0xe000);
     addresses.add(address);
    }
   }

   assert.equal(addresses.size,expectedUnique);
  }
 });
}