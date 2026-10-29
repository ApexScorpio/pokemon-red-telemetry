'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {resolveStaticTextPointer}=require('../romTextPointerEvidence');
function fixture(){
 const rom=Buffer.alloc(1048576),mapBank=6,textPointerCpu=0x5000;
 const table=6*0x4000+0x1000;return {rom,mapBank,textPointerCpu,table};
}
test('ROM0 special mart script resolves with no invented outcome',()=>{
 const f=fixture();f.rom.writeUInt16LE(0x24ea,f.table);f.rom[0x24ea]=0xfe;
 const r=resolveStaticTextPointer({...f,textId:1});
 assert.equal(r.verified,true);assert.equal(r.romBank,0);
 assert.equal(r.command,'SCRIPT_MART');assert.equal(r.dialogueExecuted,false);
});
test('ROMX text asm preserves static pointer but makes no effect claim',()=>{
 const f=fixture();f.rom.writeUInt16LE(0x6000,f.table);
 f.rom[6*0x4000+0x2000]=0x08;
 const r=resolveStaticTextPointer({...f,textId:1});
 assert.equal(r.verified,true);assert.equal(r.romBank,6);
 assert.equal(r.command,'TX_START_ASM');assert.equal(r.textOutcomeVerified,false);
});
test('ROM0 far text follows second bank and validates TX_START',()=>{
 const f=fixture();f.rom.writeUInt16LE(0x24e5,f.table);
 f.rom[0x24e5]=0x17;f.rom.writeUInt16LE(0x4374,0x24e6);f.rom[0x24e8]=41;
 f.rom[41*0x4000+0x374]=0;
 const r=resolveStaticTextPointer({...f,textId:1});
 assert.equal(r.verified,true);assert.equal(r.command,'TX_FAR');
 assert.equal(r.far.verified,true);assert.equal(r.far.bank,41);
 assert.equal(r.dialogueExecuted,false);
 f.rom[41*0x4000+0x374]=1;
 assert.equal(resolveStaticTextPointer({...f,textId:1}).verified,false);
});
test('missing index and invalid text table cannot become verified',()=>{
 const f=fixture();assert.equal(resolveStaticTextPointer({...f,textId:0}).verified,false);
 assert.equal(resolveStaticTextPointer({...f,textId:64}).verified,false);
 assert.equal(resolveStaticTextPointer({...f,textId:1,textPointerCpu:0}).verified,false);
});
