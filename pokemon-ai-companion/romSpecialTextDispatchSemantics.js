'use strict';
// Gen I special text dispatcher classification from cartridge opcode.
// Pinned reference: pret/pokered@171e2c204f9c1ff8e577ca387a4bbb009e130843
// macros/scripts/text.asm and home/text_script.asm.
// Static handler reference is NOT proof of access, effect or execution.
const TABLE=Object.freeze({
  0xff:{command:'SCRIPT_POKECENTER_NURSE',handler:'DisplayPokemonCenterDialogue',service:'POKEMON_CENTER_HEALING_DIALOGUE'},
  0xfe:{command:'SCRIPT_MART',handler:'DisplayPokemartDialogue',service:'POKEMART_PURCHASE_DIALOGUE'},
  0xfd:{command:'SCRIPT_BILLS_PC',handler:'TextScript_BillsPC',service:'BILLS_PC_MENU'},
  0xfc:{command:'SCRIPT_PLAYERS_PC',handler:'TextScript_ItemStoragePC',service:'ITEM_STORAGE_PC_MENU'},
  0xf9:{command:'SCRIPT_POKECENTER_PC',handler:'TextScript_PokemonCenterPC',service:'POKEMON_CENTER_PC_MENU'},
  0xf7:{command:'SCRIPT_PRIZE_VENDOR',handler:'TextScript_GameCornerPrizeMenu',service:'GAME_CORNER_PRIZE_MENU'},
  0xf6:{command:'SCRIPT_CABLE_CLUB_RECEPTIONIST',handler:'CableClubNPC',service:'CABLE_CLUB_DIALOGUE'},
  0xf5:{command:'SCRIPT_VENDING_MACHINE',handler:'VendingMachineMenu',service:'VENDING_MACHINE_MENU'}
});
const fail=reason=>({verified:false,reason,handlerReferenceVerified:false,
 gameplayActionObserved:false,scriptEffectsVerified:false,accessibleNow:null,
 completedNow:null});
function inspectSpecialTextDispatch({rom,scriptFileOffset,scriptCommand,mart}={}){
  if(!Buffer.isBuffer(rom)||rom.length!==1048576||
     !Number.isInteger(scriptFileOffset)||scriptFileOffset<0||
     scriptFileOffset>=rom.length||typeof scriptCommand!=='string')
    return fail('ROM, offset ou comando invalido');
  const byte=rom[scriptFileOffset],entry=TABLE[byte];
  if(!entry||entry.command!==scriptCommand)
    return fail('Comando especial nao corresponde ao opcode fisico ROM');
  let staticItemIds=null;
  if(byte===0xfe){
    const bankEnd=(Math.floor(scriptFileOffset/0x4000)+1)*0x4000;
    if(scriptFileOffset+3>bankEnd)return fail('Lista mart truncada no banco');
    const count=rom[scriptFileOffset+1];
    if(count>32||scriptFileOffset+count+3>bankEnd||
       rom[scriptFileOffset+2+count]!==0xff)
      return fail('Lista mart sem comprimento ou terminador valido');
    staticItemIds=[...rom.subarray(scriptFileOffset+2,scriptFileOffset+2+count)];
    if(staticItemIds.some(x=>x===0||x===0xff)||
       mart?.verified!==true||mart.itemCount!==count||
       !Array.isArray(mart.itemIds)||
       mart.itemIds.length!==count||
       mart.itemIds.some((x,i)=>x!==staticItemIds[i]))
      return fail('Inventario fisico nao coincide com prova independente');
  } else if(mart!==null&&mart!==undefined){
    return fail('Inventario mart associado a comando nao mart');
  }
  return {verified:true,handlerReferenceVerified:true,
    scriptFileOffset,opcode:byte,scriptCommand,
    referenceHandler:entry.handler,conditionalService:entry.service,
    staticItemIds,referenceSource:'pret/pokered',
    referenceCommit:'171e2c204f9c1ff8e577ca387a4bbb009e130843',
    handlerImplementationInCartridgeVerified:false,
    dialogueOrMenuMayBeOfferedIfExecuted:true,
    gameplayActionObserved:false,scriptEffectsVerified:false,
    accessibleNow:null,completedNow:null,priceVerified:false,
    source:'PHYSICAL_ROM_SPECIAL_OPCODE_AND_PINNED_DISPATCH_REFERENCE'};
}
module.exports={inspectSpecialTextDispatch};
