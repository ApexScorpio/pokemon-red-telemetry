'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {locateScriptedBattleRamCandidates,assessScriptedBattleRamReadback}=
 require('../romScriptedBattleRam');
const {readRom,KNOWN}=require('../romComprehensiveAudit');
const {inspectRomBuffer}=require('../romVariantRegistry');
const SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function atlas(){
 const entries=[[96,2,0x0614e6,'SS_ANNE_2F','wSSAnne2FCurScript'],
  [135,11,0x048e9d,'GAME_CORNER','wGameCornerCurScript']]
  .map(([mapId,ordinal,txAsmFileOffset,referenceMapName,referenceScriptVariable])=>({
   mapId,ordinal,txAsmFileOffset,referenceMapName,referenceScriptVariable,
   sourceReferenceOnly:true,battleWon:null,
   referenceSemanticsVerifiedInThisRom:false}));
 return {verified:true,romSha256:SHA,
  scriptedBattleReferenceEvidence:{verified:true,romSha256:SHA,
   referenceCases:2,referenceCommit:'c9181e91388686b6e8618cf6bef58506d93214f8',
   entries}};
}
function referenceLayout(){
 return {verified:true,romSha256:SHA,count:2,candidates:[
  {mapId:96,ordinal:2,handlerBank:24,
   referenceVariable:'wSSAnne2FCurScript',
   referenceWramAddress:0xd665,worldBlockOffset:197,
   addressProvenFromActualRomInstructions:false,referenceLayoutOnly:true},
  {mapId:135,ordinal:11,handlerBank:18,
   referenceVariable:'wGameCornerCurScript',
   referenceWramAddress:0xd65f,worldBlockOffset:191,
   addressProvenFromActualRomInstructions:false,referenceLayoutOnly:true}
 ]};
}
function fixture(){
 const rom=Buffer.alloc(1048576,0xc9);
 for(const [bank,address,offset] of [[24,0xd665,0x140],
  [18,0xd65f,0x250]]){
  rom[bank*0x4000+offset]=0xfa;
  rom[bank*0x4000+offset+1]=address&255;
  rom[bank*0x4000+offset+2]=address>>8;
  rom[bank*0x4000+offset+4]=0xea;
  rom[bank*0x4000+offset+5]=address&255;
  rom[bank*0x4000+offset+6]=address>>8;
 }
 return rom;
}
test('reference addresses D665 and D65F lie in existing D5A0 RAM window',()=>{
 assert.equal(0xd665-0xd5a0,197);
 assert.equal(0xd65f-0xd5a0,191);
 assert.equal(0xd6f0-56,0xd6b8);
 assert.equal(0xd6b8-78-5,0xd665);
 assert.equal(0xd665-6,0xd65f);
});
test('refuses an unverified ROM or atlas, including mismatched hash',()=>{
 assert.equal(locateScriptedBattleRamCandidates().verified,false);
 const rom=fixture();
 const x=locateScriptedBattleRamCandidates({rom,scriptAtlas:atlas()});
 assert.equal(x.verified,false); // mocked ROM is not the original SHA
});
test('double-read verifier remains closed on missing source or wrong map',()=>{
 const l=referenceLayout();
 const bytes=Array(784).fill('00');bytes[197]='04';
 const base={layout:l,romSha256:SHA,mapId:96,
  firstWorldBlockHex:bytes,repeatScriptHex:'04',
  repeatMapHex:'60',romIdentityMatched:true,
  mapPositionVerified:true,secondReadFromSameTargetVerified:true};
 assert.equal(assessScriptedBattleRamReadback({...base,repeatScriptHex:'03'}).verified,false);
 assert.equal(assessScriptedBattleRamReadback({...base,repeatMapHex:'87'}).verified,false);
 assert.equal(assessScriptedBattleRamReadback({...base,secondReadFromSameTargetVerified:false}).verified,false);
 assert.equal(assessScriptedBattleRamReadback({...base,romSha256:'0'.repeat(64)}).verified,false);
 assert.equal(assessScriptedBattleRamReadback({...base,firstWorldBlockHex:bytes.slice(2)}).verified,false);
 const ok=assessScriptedBattleRamReadback(base);
 assert.equal(ok.verified,true,ok.reason);
 assert.equal(ok.referenceStateName,'SCRIPT_SSANNE2F_NOOP');
 assert.equal(ok.scriptValue,4);
 assert.equal(ok.battleWon,null);
 assert.equal(ok.canBattleNow,null);
 assert.equal(ok.completedGameplayCertified,false);
});
test('Game Corner state index is reference-only and never proves Rocket victory',()=>{
 const l=referenceLayout();
 const bytes=Array(784).fill('00');bytes[191]='02';
 const a=assessScriptedBattleRamReadback({layout:l,mapId:135,
  romSha256:SHA,firstWorldBlockHex:bytes,repeatScriptHex:'02',
  repeatMapHex:'87',romIdentityMatched:true,mapPositionVerified:true,
  secondReadFromSameTargetVerified:true});
 assert.equal(a.verified,true);
 assert.equal(a.referenceStateName,'SCRIPT_GAMECORNER_ROCKET_EXIT');
 assert.equal(a.battleWon,null);
 assert.equal(a.completedGameplayCertified,false);
});
for(const [variant,name] of [['red','POKEMON_RED_ROM'],
 ['blue','POKEMON_BLUE_ROM'],['green','POKEMON_GREEN_ROM']]){
 test('actual '+variant+' ROM scans only the two physical banks for script variable literals',
 {skip:!process.env[name]?'Original ROM required':false},()=>{
  const rom=readRom(process.env[name]);
  const profile=inspectRomBuffer(rom,variant+'.gb');
  assert.equal(profile.hash.sha256,KNOWN[variant]);
  const layout=profile.world.interactionScriptAtlas.scriptedBattleRamCandidates;
  assert.equal(layout.verified,true,layout.reason);
  assert.equal(layout.romSha256,KNOWN[variant]);
  assert.deepEqual(layout.candidates.map(x=>[x.mapId,x.referenceWramAddress,
   x.handlerBank,x.worldBlockOffset]),[
   [96,0xd665,24,197],[135,0xd65f,18,191]]);
  assert.ok(layout.candidates.every(x=>
   x.physicalBankScanned===0x4000&&
   x.referenceLayoutOnly===true&&
   x.runtimeReadbackAvailable===false&&
   x.battleWon===null));
 });
}

test('a forged partial layout or wrong script address cannot impersonate a readback',()=>{
 const bytes=Array(784).fill('00');bytes[197]='04';
 const read=(layout)=>assessScriptedBattleRamReadback({
  layout,mapId:96,romSha256:SHA,firstWorldBlockHex:bytes,
  repeatScriptHex:'04',repeatMapHex:'60',
  romIdentityMatched:true,mapPositionVerified:true,
  secondReadFromSameTargetVerified:true});
 const small=referenceLayout();small.candidates.pop();
 assert.equal(read(small).verified,false);
 const wrong=referenceLayout();wrong.candidates[0].referenceWramAddress++;
 assert.equal(read(wrong).verified,false);
 const swapped=referenceLayout();swapped.candidates.reverse();
 assert.equal(read(swapped).verified,false);
});
