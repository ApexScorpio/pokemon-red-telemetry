'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {decodeFirstRomText}=require('../romStaticDialogue');
const mk=(bytes,offset=0x18000)=>{
 const rom=Buffer.alloc(1048576);rom.set([0,...bytes],offset);
 return {rom,offset};
};
test('Lê primeira cadeia da ROM sem afirmar execução',()=>{
 const r=decodeFirstRomText(mk([0x87,0xa8,0x7f,0x93,0xa7,0xa4,0xb1,0xa4,0xe7,0x57]));
 assert.equal(r.verified,true);assert.equal(r.text,'Hi There!');
 assert.equal(r.terminatorByte,0x57);assert.equal(r.firstStringOnly,true);
 assert.equal(r.textOutcomeVerified,false);assert.equal(r.dialogueExecuted,false);
});
test('PLAYER permanece variável, não é substituído por nome inventado',()=>{
 const r=decodeFirstRomText(mk([0x87,0xa8,0x7f,0x52,0xe7,0x58]));
 assert.equal(r.verified,true);assert.equal(r.text,'Hi <PLAYER>!');
 assert.equal(r.containsRuntimeVariables,true);assert.equal(r.literalTextOnly,false);
});
test('Conserva quebras e contracções da charmap ocidental Gen I',()=>{
 const r=decodeFirstRomText(mk([0x80,0x4f,0x81,0xbb,0x7f,0xf6,0xff,0x50]));
 assert.equal(r.verified,true);assert.equal(r.text,"A\nB'd 09");
});
test('Não atravessa um banco ROM se falta terminador',()=>{
 const offset=0x1bffe,rom=Buffer.alloc(1048576);
 rom[offset]=0;rom[offset+1]=0x80;rom[offset+2]=0x50;
 assert.equal(decodeFirstRomText({rom,offset}).verified,false);
});
test('Rejeita bytecode de script dentro da cadeia',()=>{
 const r=decodeFirstRomText(mk([0x80,0x08,0x50]));
 assert.equal(r.verified,false);assert.match(r.reason,/sem tradução/);
});
test('Rejeita texto vazio, sem terminador e ROM truncada',()=>{
 assert.equal(decodeFirstRomText(mk([0x50])).verified,false);
 assert.equal(decodeFirstRomText(mk(Array.from({length:241},()=>0x80))).verified,false);
 assert.equal(decodeFirstRomText({rom:Buffer.alloc(10),offset:0}).verified,false);
});
test('Limites explícitos não podem permitir leitura fora da ROM',()=>{
 const x=mk([0x80,0x57]);
 assert.equal(decodeFirstRomText({...x,maxBytes:241}).verified,false);
 assert.equal(decodeFirstRomText({...x,offset:-1}).verified,false);
 assert.equal(decodeFirstRomText({...x,maxBytes:1}).verified,false);
});

test('Hall of Fame ROM-style first text over 240 bytes needs explicit bounded opt-in',()=>{
 const x=mk([...Array(298).fill(0x80),0x57]);
 assert.equal(decodeFirstRomText({...x,maxBytes:512}).verified,false);
 const extended=decodeFirstRomText({...x,maxBytes:512,
   allowExtended:true});
 assert.equal(extended.verified,true);
 assert.equal(extended.text.length,298);
 assert.equal(extended.terminatorByte,0x57);
 assert.equal(extended.dialogueExecuted,false);
 assert.equal(decodeFirstRomText({...x,maxBytes:1025,
   allowExtended:true}).verified,false);
});
