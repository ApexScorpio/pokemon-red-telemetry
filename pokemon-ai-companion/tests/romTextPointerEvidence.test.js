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

test('ROM0 mart inventory gives item IDs, never prices or executed purchase',()=>{
 const f=fixture(),addr=0x24ea;
 f.rom.writeUInt16LE(addr,f.table);
 f.rom.set([0xfe,3,4,20,29,0xff],addr);
 const r=resolveStaticTextPointer({...f,textId:1});
 assert.equal(r.verified,true,r.reason);
 assert.equal(r.command,'SCRIPT_MART');
 assert.deepEqual(r.mart.itemIds,[4,20,29]);
 assert.equal(r.mart.itemCount,3);
 assert.equal(r.mart.inventoryAvailableNow,null);
 assert.equal(r.mart.pricesVerified,false);
 assert.equal(r.mart.purchaseObserved,false);
 assert.equal(r.dialogueExecuted,false);
});
test('mart list rejects invalid length, IDs or terminator',()=>{
 const f=fixture(),addr=0x24ea;
 f.rom.writeUInt16LE(addr,f.table);
 f.rom.set([0xfe,3,4,20,29,0xff],addr);
 for(const [index,value] of [[1,0],[1,33],[2,0],[5,0]]){
   const original=Buffer.from(f.rom);
   f.rom[addr+index]=value;
   assert.equal(resolveStaticTextPointer({...f,textId:1}).verified,false);
   original.copy(f.rom);
 }
});

test('TX_FAR fornece primeira cadeia auditada sem afirmar diálogo',()=>{
 const f=fixture(),target=41*0x4000+0x374;
 f.rom.writeUInt16LE(0x24e5,f.table);
 f.rom[0x24e5]=0x17;
 f.rom.writeUInt16LE(0x4374,0x24e6);f.rom[0x24e8]=41;
 f.rom.set([0,0x87,0xa8,0x7f,0x52,0xe7,0x57],target);
 const r=resolveStaticTextPointer({...f,textId:1});
 assert.equal(r.verified,true);
 assert.equal(r.far.verified,true);
 assert.equal(r.staticTextPreview.verified,true);
 assert.equal(r.staticTextPreview.text,'Hi <PLAYER>!');
 assert.equal(r.staticTextPreview.containsRuntimeVariables,true);
 assert.equal(r.staticTextPreview.dialogueExecuted,false);
 assert.equal(r.staticTextPreview.textOutcomeVerified,false);
});
test('texto inválido não desmente um ponteiro TX_FAR estruturalmente válido',()=>{
 const f=fixture(),target=41*0x4000+0x374;
 f.rom.writeUInt16LE(0x24e5,f.table);
 f.rom[0x24e5]=0x17;f.rom.writeUInt16LE(0x4374,0x24e6);
 f.rom[0x24e8]=41;
 f.rom.set([0,0x80,0x08,0x50],target);
 const r=resolveStaticTextPointer({...f,textId:1});
 assert.equal(r.verified,true);
 assert.equal(r.far.verified,true);
 assert.equal(r.staticTextPreview,null);
});

test('TX_FAR preserva segmentos completos da sequência ROM e variáveis RAM',()=>{
 const f=fixture(),target=41*0x4000+0x374;
 f.rom.writeUInt16LE(0x24e5,f.table);
 f.rom.set([0x17,0x74,0x43,41],0x24e5);
 f.rom.set([
   0,0x87,0xa8,0x57,0x01,0x00,0xc0,
   0,0x93,0xa7,0xa4,0xb1,0xa4,0x58,0x50
 ],target);
 const r=resolveStaticTextPointer({...f,textId:1});
 assert.equal(r.verified,true);
 assert.equal(r.staticTextPreview.text,'Hi');
 assert.equal(r.staticTextPreview.program.verified,true);
 assert.equal(r.staticTextPreview.program.scriptComplete,true);
 assert.equal(r.staticTextPreview.program.text,'Hi | There');
 assert.equal(r.staticTextPreview.program.segmentCount,2);
 assert.equal(r.staticTextPreview.program.containsRuntimeCommands,true);
 assert.equal(r.staticTextPreview.program.dialogueExecuted,false);
});
test('TX_FAR mantém primeira prévia mas nunca certifica programa ASM',()=>{
 const f=fixture(),target=41*0x4000+0x374;
 f.rom.writeUInt16LE(0x24e5,f.table);
 f.rom.set([0x17,0x74,0x43,41],0x24e5);
 f.rom.set([0,0x80,0x57,0x08,0x50],target);
 const r=resolveStaticTextPointer({...f,textId:1});
 assert.equal(r.verified,true);
 assert.equal(r.staticTextPreview.text,'A');
 assert.equal(r.staticTextPreview.program,undefined);
 assert.equal(r.textOutcomeVerified,false);
});
