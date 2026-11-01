'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const {KNOWN,readRom}=
 require('../romComprehensiveAudit');

const {interpretHandler}=
 require('../romScriptSemantics');

const {groupMapRootIndexedJumpRequirements}=
 require('../romMapScriptRootSemantics');

const {buildIndexedJumpTargetWords}=
 require('../romIndexedJumpTargetWords');

test('wrong ROM evidence is rejected',()=>{
 const fake=Buffer.alloc(1048576);

 assert.deepEqual(
  buildIndexedJumpTargetWords({
   rom:fake,
   romSha256:KNOWN.red,
   requirements:[]
  }),
  []
 );

 assert.deepEqual(
  buildIndexedJumpTargetWords({
   rom:null,
   romSha256:KNOWN.red,
   requirements:[]
  }),
  []
 );
});

test('UI and map-root evidence remain guarded',()=>{
 const root=fs.readFileSync(
  path.join(__dirname,'..',
   'romMapScriptRootSemantics.js'),'utf8'
 );

 const app=fs.readFileSync(
  path.join(__dirname,'..','public','app.js'),
  'utf8'
 );

 assert.ok(root.includes(
  'indexedRomTableWords,'
 ));

 assert.ok(root.includes(
  'indexedRomTableWords:Array.isArray('
 ));

 assert.ok(app.includes(
  'indexedRomTableWordsT233'
 ));

 assert.ok(app.includes(
  'table.bankSelectionObserved!==false'
 ));

 assert.ok(app.includes(
  'table.instructionTargetsProven!==false'
 ));
});

for(const [variant,envName,offsets] of [
 ['red','POKEMON_RED_ROM',[0x19d0b,0x59cf1]],
 ['blue','POKEMON_BLUE_ROM',[0x19d0b,0x59cf1]],
 ['green','POKEMON_GREEN_ROM',[0x19d0b,0x59cf1]]
]){
 test('actual ROM indexed tables: '+variant,{
  skip:!process.env[envName]?
   'Original ROM variable not provided':false
 },()=>{
  const rom=readRom(process.env[envName]);

  const sha=crypto.createHash('sha256')
   .update(rom).digest('hex');

  assert.equal(sha,KNOWN[variant]);

  let found=0;

  for(const offset of offsets){
   const analysis=interpretHandler({
    rom,
    fileOffset:offset,
    entryKind:'MAP_SCRIPT_ROOT'
   });

   assert.equal(analysis.verified,true);

   const groups=
    groupMapRootIndexedJumpRequirements(
     analysis.indexedJumpRequirements
    );

   if(!groups.length)continue;

   const tables=buildIndexedJumpTargetWords({
    rom,
    romSha256:sha,
    requirements:groups
   });

   assert.equal(tables.length,groups.length);

   for(const table of tables){
    found++;

    assert.equal(table.pointerPositions,128);
    assert.equal(table.inputBytePossibilities,256);
    assert.equal(
     table.targetWordsLittleEndianHex.length,
     512
    );

    assert.equal(
     table.bankSelectionObserved,
     false
    );

    assert.equal(
     table.indirectJumpObserved,
     false
    );

    assert.equal(
     table.instructionTargetsProven,
     false
    );

    assert.equal(
     table.gameEventCompleted,
     false
    );

    const bytes=Buffer.from(
     table.targetWordsLittleEndianHex,'hex'
    );

    assert.equal(bytes.length,256);

    assert.ok(
     bytes.equals(
      rom.subarray(
       table.firstPhysicalOffset,
       table.firstPhysicalOffset+256
      )
     )
    );

    const targets=new Set();

    for(let i=0;i<128;i++)
     targets.add(bytes.readUInt16LE(i*2));

    assert.equal(
     targets.size,
     table.uniqueRawTargetWords
    );
   }
  }

  assert.ok(
   found>0,
   'No indexed ROM table found in priority roots'
  );
 });
}