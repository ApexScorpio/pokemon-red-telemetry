'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {decodeRomTextProgram}=require('../romTextScriptDecoder');
const mk=(bytes,offset=0x18000)=>{
 const rom=Buffer.alloc(1048576);rom.set(bytes,offset);return {rom,offset};
};
test('desmonta dois TX_START e TX_END sem atribuir ações ao jogador',()=>{
 const r=decodeRomTextProgram(mk([
   0,0x87,0xa8,0x50,0,0x93,0xa7,0xa4,0xb1,0xa4,0x58,0x50]));
 assert.equal(r.verified,true);
 assert.equal(r.scriptComplete,true);
 assert.equal(r.text,'Hi | There');
 assert.equal(r.segmentCount,2);
 assert.equal(r.termination,'TEXT_PROMPT');
 assert.deepEqual(r.commands,['TX_START','TX_START']);
 assert.equal(r.dialogueExecuted,false);
 assert.equal(r.textOutcomeVerified,false);
 assert.equal(r.scriptEffectsVerified,false);
});
test('separa comandos RAM de texto literal sem inventar valores',()=>{
 const r=decodeRomTextProgram(mk([
   0,0x87,0xa8,0x50,0x01,0x00,0xc0,0,0x80,0x57,0x50]));
 assert.equal(r.verified,true);
 assert.equal(r.text,'Hi | A');
 assert.equal(r.containsRuntimeCommands,true);
 assert.equal(r.containsRuntimeText,false);
 assert.deepEqual(r.commands,['TX_START','TX_RAM','TX_START']);
});
test('PLACE_STRING PLAYER é variável mesmo sem opcode TX_RAM',()=>{
 const r=decodeRomTextProgram(mk([0,0x87,0xa8,0x52,0x57,0x50]));
 assert.equal(r.verified,true);
 assert.equal(r.containsRuntimeText,true);
 assert.equal(r.containsRuntimeCommands,false);
});
test('preserva TX_END depois do @ da primeira cadeia',()=>{
 const r=decodeRomTextProgram(mk([0,0x80,0x50,0x50]));
 assert.equal(r.verified,true);
 assert.equal(r.text,'A');
 assert.equal(r.byteLength,4);
});
test('consome tamanho exato de controlos e som, sem inferir efeito',()=>{
 const r=decodeRomTextProgram(mk([
   0x05,0x06,0x07,0x0a,0x0b,0x0c,3,0x0d,0x16,
   0,0x80,0x57,0x50]));
 assert.equal(r.verified,true);
 assert.equal(r.hasDisplayControls,true);
 assert.equal(r.containsRuntimeCommands,false);
 assert.equal(r.commands.length,9);
 assert.equal(r.text,'A');
});
test('comandos TX_BCD, TX_NUM e TX_BOX respeitam operandos',()=>{
 const r=decodeRomTextProgram(mk([
   0x02,0x00,0xc0,0x42,0x09,0x23,0xc1,0x12,
   0x04,0x01,0xc4,0x03,0x12,
   0,0x80,0x57,0x50]));
 assert.equal(r.verified,true);
 assert.equal(r.containsRuntimeCommands,true);
 assert.equal(r.hasDisplayControls,true);
 assert.deepEqual(r.commands,['TX_BCD','TX_NUM','TX_BOX','TX_START']);
});
test('não declara programa completo perante ASM ou outro TX_FAR',()=>{
 const x=mk([0,0x80,0x50,0x08,0x50]);
 assert.equal(decodeRomTextProgram(x).verified,false);
 const y=mk([0,0x80,0x50,0x17,0x00,0x40,0x29,0x50]);
 assert.equal(decodeRomTextProgram(y).verified,false);
});
test('não atravessa banco físico nem usa padding zero como texto válido',()=>{
 const x=mk([0,0x80,0x57],0x1bffe);
 assert.equal(decodeRomTextProgram(x).verified,false);
 const y=mk([0,0x80,0x50,0xff,0x50]);
 assert.equal(decodeRomTextProgram(y).verified,false);
});
test('truncaturas, bytes inválidos e cadeias longas não viram prova',()=>{
 assert.equal(decodeRomTextProgram(mk([0x01,0x42,0x50])).verified,false);
 assert.equal(decodeRomTextProgram(mk([0,0x80,0x08,0x57,0x50])).verified,false);
 assert.equal(decodeRomTextProgram(mk([0,0x80,0x50])).verified,false);
 const s=mk([0,0x80,0x57,0x50]);
 assert.equal(decodeRomTextProgram({...s,maxBytes:3}).verified,false);
 assert.equal(decodeRomTextProgram({...s,maxCommands:1}).verified,false);
 assert.equal(decodeRomTextProgram({...s,maxBytes:1025}).verified,false);
 assert.equal(decodeRomTextProgram({...s,maxCommands:65}).verified,false);
 assert.equal(decodeRomTextProgram({rom:Buffer.alloc(20),offset:0}).verified,false);
});
test('um TX_END vazio não cria fala nem conclusão',()=>{
 assert.equal(decodeRomTextProgram(mk([0x50])).verified,false);
});

test('DONE e PROMPT terminam diretamente o texto, sem executar bytes seguintes',()=>{
 const a=decodeRomTextProgram(mk([0,0x80,0x57,0x08,0x50]));
 assert.equal(a.verified,true);
 assert.equal(a.termination,'TEXT_DONE');
 assert.equal(a.text,'A');
 assert.equal(a.byteLength,3);
 const b=decodeRomTextProgram(mk([0,0x81,0x58,0x17,0x00,0x40,0x29]));
 assert.equal(b.verified,true);
 assert.equal(b.termination,'TEXT_PROMPT');
 assert.equal(b.text,'B');
});
test('DEXEND não pode ser confundido com fim linear de diálogo',()=>{
 const a=decodeRomTextProgram(mk([0,0x80,0x5f,0x50]));
 assert.equal(a.verified,false);
 assert.match(a.reason,/DEXEND/);
});
