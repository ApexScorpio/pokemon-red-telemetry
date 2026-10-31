'use strict';
// Decode only the FIRST literal TX_START string from an audited Gen I ROM.
// A text preview is not a claim that a dialogue, choice, or script ran.
const BANK_SIZE=0x4000;
const symbols=new Map([
 [0x49,'\n'],[0x4a,'<PKMN>'],[0x4b,'\n'],[0x4c,'\n'],
 [0x4e,'\n'],[0x4f,'\n'],[0x51,'\n\n'],[0x52,'<PLAYER>'],
 [0x53,'<RIVAL>'],[0x54,'POKé'],[0x55,'\n'],[0x56,'……'],
 [0x59,'<TARGET>'],[0x5a,'<USER>'],[0x5b,'PC'],[0x5c,'TM'],
 [0x5d,'TRAINER'],[0x5e,'ROCKET'],[0x70,'‘'],[0x71,'’'],
 [0x72,'“'],[0x73,'”'],[0x74,'·'],[0x75,'…'],
 [0x7f,' '],[0x9a,'('],[0x9b,')'],[0x9c,':'],[0x9d,';'],
 [0x9e,'['],[0x9f,']'],[0xba,'é'],[0xbb,"'d"],[0xbc,"'l"],
 [0xbd,"'s"],[0xbe,"'t"],[0xbf,"'v"],[0xe0,"'"],
 [0xe1,'<PK>'],[0xe2,'<MN>'],[0xe3,'-'],[0xe4,"'r"],
 [0xe5,"'m"],[0xe6,'?'],[0xe7,'!'],[0xe8,'.'],
 [0xef,'♂'],[0xf0,'¥'],[0xf1,'×'],[0xf2,'.'],
 [0xf3,'/'],[0xf4,','],[0xf5,'♀']
]);
const dynamicBytes=new Set([0x52,0x53,0x59,0x5a]);
const fail=reason=>({verified:false,reason,text:null,firstStringOnly:true,
 textOutcomeVerified:false,dialogueExecuted:false});
function decodeFirstRomText({rom,offset,maxBytes=240,allowExtended=false}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    !Number.isInteger(offset)||offset<0||offset>=rom.length||
    !Number.isInteger(maxBytes)||maxBytes<1||
    maxBytes>(allowExtended===true?1024:240)||
    typeof allowExtended!=='boolean')
   return fail('Parâmetros ou ROM inválidos');
 if(rom[offset]!==0x00)return fail('Destino não é TX_START');
 const bankEnd=Math.min(rom.length,(Math.floor(offset/BANK_SIZE)+1)*BANK_SIZE);
 const parts=[];let containsRuntimeVariables=false;
 for(let p=offset+1;p<bankEnd&&p-offset<=maxBytes;p++){
   const byte=rom[p];
   if(byte===0x50||byte===0x57||byte===0x58||byte===0x5f){
     const text=parts.join('');
     if(!text.trim())return fail('Primeira cadeia vazia');
     return {verified:true,text,byteLength:p-offset+1,
       terminatorByte:byte,firstStringOnly:true,
       containsRuntimeVariables,
       literalTextOnly:!containsRuntimeVariables,
       textOutcomeVerified:false,dialogueExecuted:false,
       source:'GEN1_ROM_TX_START_FIRST_STRING'};
   }
   let glyph=null;
   if(byte>=0x80&&byte<=0x99)glyph=String.fromCharCode(65+byte-0x80);
   else if(byte>=0xa0&&byte<=0xb9)glyph=String.fromCharCode(97+byte-0xa0);
   else if(byte>=0xf6&&byte<=0xff)glyph=String.fromCharCode(48+byte-0xf6);
   else if(symbols.has(byte))glyph=symbols.get(byte);
   if(glyph===null)return fail('Carácter/control ROM sem tradução fiável: 0x'+byte.toString(16));
   if(dynamicBytes.has(byte))containsRuntimeVariables=true;
   parts.push(glyph);
 }
 return fail('Texto sem terminador dentro do limite ou do banco ROM');
}
module.exports={decodeFirstRomText};
