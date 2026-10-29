'use strict';
// Conservative read-only disassembly of a single linear Gen I text command
// stream. See pret/pokered macros/scripts/text.asm and home/text.asm.
// 'Complete' means TX_END was found in this linear byte stream, not that
// the NPC's script, choices, conditions, or gameplay have been evaluated.
const {decodeFirstRomText}=require('./romStaticDialogue');
const BANK=0x4000;
const fail=(reason,extra={})=>({verified:false,scriptComplete:false,
  reason,dialogueExecuted:false,textOutcomeVerified:false,
  ...extra});
const names={
  0x01:'TX_RAM',0x02:'TX_BCD',0x03:'TX_MOVE',0x04:'TX_BOX',
  0x05:'TX_LOW',0x06:'TX_PROMPT_BUTTON',0x07:'TX_SCROLL',
  0x08:'TX_START_ASM',0x09:'TX_NUM',0x0a:'TX_PAUSE',
  0x0b:'TX_SOUND_GET_ITEM_1',0x0c:'TX_DOTS',0x0d:'TX_WAIT_BUTTON',
  0x0e:'TX_SOUND_POKEDEX_RATING',0x0f:'TX_SOUND_GET_ITEM_1_DUPLICATE',
  0x10:'TX_SOUND_GET_ITEM_2',0x11:'TX_SOUND_GET_KEY_ITEM',
  0x12:'TX_SOUND_CAUGHT_MON',0x13:'TX_SOUND_DEX_PAGE_ADDED',
  0x14:'TX_SOUND_CRY_NIDORINA',0x15:'TX_SOUND_CRY_PIDGEOT',
  0x16:'TX_SOUND_CRY_DEWGONG',0x17:'TX_FAR'
};
const operandLengths={0x01:2,0x02:3,0x03:2,0x04:4,
  0x09:3,0x0c:1,0x17:3};
function decodeRomTextProgram({rom,offset,maxBytes=1024,maxCommands=64}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||
    !Number.isInteger(offset)||offset<0||offset>=rom.length||
    !Number.isInteger(maxBytes)||maxBytes<2||maxBytes>1024||
    !Number.isInteger(maxCommands)||maxCommands<1||maxCommands>64)
   return fail('ROM ou limites do programa de texto inválidos');
 const bankEnd=(Math.floor(offset/BANK)+1)*BANK;
 const end=Math.min(bankEnd,offset+maxBytes);
 let ptr=offset,containsRuntimeText=false,containsRuntimeCommands=false,
   hasDisplayControls=false,commandCount=0;
 const segments=[],commands=[];
 while(ptr<end&&commandCount<maxCommands){
   const op=rom[ptr];commandCount++;
   if(op===0x50){
     if(!segments.length)return fail('TX_END sem segmentos literais');
     return {verified:true,scriptComplete:true,firstStringOnly:false,
       text:segments.join(' | '),segments,segmentCount:segments.length,
       commands,commandCount,byteLength:ptr-offset+1,
       containsRuntimeText,containsRuntimeCommands,hasDisplayControls,
       dialogueExecuted:false,textOutcomeVerified:false,
       npcScriptExecuted:false,scriptEffectsVerified:false,
       source:'GEN1_ROM_LINEAR_TEXT_COMMAND_STREAM'};
   }
   if(op===0x00){
     const remaining=Math.min(240,end-ptr);
     if(remaining<2)return fail('TX_START truncado');
     const piece=decodeFirstRomText({rom,offset:ptr,maxBytes:remaining-1});
     if(piece.verified!==true)return fail('TX_START não descodificável: '+piece.reason);
     if(segments.length>=12||segments.join('').length+piece.text.length>720)
       return fail('Limite de segmentos literais excedido');
     segments.push(piece.text);
     containsRuntimeText ||=piece.containsRuntimeVariables;
     commands.push('TX_START');
     ptr+=piece.byteLength;
     continue;
   }
   if(!Object.hasOwn(names,op))
     return fail('Opcode de texto não reconhecido: 0x'+op.toString(16));
   // TX_START_ASM can execute arbitrary code; TX_FAR requires a separate
   // recursive bank-aware analysis. Do not claim this stream is complete.
   if(op===0x08||op===0x17)
     return fail('Fluxo não linear ou assembly: '+names[op]);
   const size=operandLengths[op]||0;
   if(ptr+1+size>end)
     return fail('Argumentos truncados para '+names[op]);
   if(op===0x01||op===0x02||op===0x09)
     containsRuntimeCommands=true;
   else hasDisplayControls=true;
   commands.push(names[op]);
   ptr+=1+size;
 }
 return fail('TX_END não encontrado dentro do banco/limites');
}
module.exports={decodeRomTextProgram};
