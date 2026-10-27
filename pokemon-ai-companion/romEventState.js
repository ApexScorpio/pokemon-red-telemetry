'use strict';
// Itens ocultos Gen I: coordenadas e ordinais derivados da ROM; bits lidos da WRAM.
// Não confundir bit 1 (obtido) com "na mochila": MissingNo pode multiplicar itens.
// A correspondência só é autorizada para os 3 SHA-256 realmente auditados.
const ROM_COORDS={
  '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b':true, // Red
  '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d':true, // Blue
  'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db':true // Green Intl 1.2.1
};
const HIDDEN_ITEM_COORDINATES_B64='MxIBMyoQPQwSJAMmFAcOZAkNaAEDFREJFTUQxw8VyREbygEZkgwEGA4BGA0Q2AkBnAEK2wUG0gMM6Q8CsAEB5AsO4wMbUxARUwEMoA8PohEZpRAI1wkBIiwJIkYTIloIwgIFwgcabwsOAQQOFgUwFz8CHA4PHC0IHEgRHFsEHHkIdwQDdyIEeQIMeQUVBg8wJAEKPQkhoRAJBQsOAwgPDwMo/w==';

 // Os 54 IDs foram obtidos, por coordenada, das entradas HiddenEventsFor_map
 // nas três ROMs originais: handler Red 1D:6688, Blue 1D:6689, Green 1D:668A.
const HIDDEN_ITEM_IDS_HEX='140b0a5050031213514f3113524f272831355211312802534f31020a36100251021053141d1228104f3653104431524f525053512803';

function parseHex(raw,size){
 if(!Array.isArray(raw)||raw.length!==size||raw.some(x=>typeof x!=='string'||!/^[a-fA-F0-9]{2}$/.test(x)))return null;
 return Uint8Array.from(raw,x=>parseInt(x,16));
}
// wToggleableObjectList: pares (sprite local, índice global da flag), 0xFF final.
// wToggleableObjectFlags: bit 1 = objeto removido do mapa; NÃO implica item adquirido.
function decodeToggleables(flagHex,listHex){
 const flags=parseHex(flagHex,32),list=parseHex(listHex,34);
 if(!flags||!list)return {verified:false,reason:'Leitura RAM das flags/lista de objetos incompleta',entries:[]};
 const entries=[];
 let terminated=false;
 const seen=new Set();
 for(let at=0;at<list.length;at+=2){
   const sprite=list[at];
   if(sprite===0xFF){terminated=true;break;}
   if(at+1>=list.length)return {verified:false,reason:'Índice global truncado',entries:[]};
   const global=list[at+1];
   if(sprite<1||sprite>15||global>=256||seen.has(sprite))
     return {verified:false,reason:'Pares de objetos RAM inválidos',entries:[]};
   seen.add(sprite);
   const removed=!!(flags[global>>3]&(1<<(global&7)));
   entries.push({spriteIndex:sprite,globalFlagIndex:global,removedFromMap:removed,
     source:'RAM D5CE (sprite→flag) + D5A6 (flags)'});
 }
 if(!terminated)return {verified:false,reason:'Lista RAM sem terminador',entries:[]};
 return {verified:true,entries,source:'wToggleableObjectList/wToggleableObjectFlags'};
}
function fromKnownRom(profile){
 // ROMs Gen I novas, desde que a tabela de eventos ocultos tenha sido
 // efetivamente descodificada e vinculada ao hash do perfil.
 const scripts=profile?.world?.hiddenItemScripts;
 const hash=profile?.hash?.sha256?.toLowerCase();
 if(scripts?.valid && scripts.sha256?.toLowerCase()===hash &&
   Array.isArray(scripts.items)&&scripts.items.length===54 &&
   scripts.items.every((x,i)=>x.hiddenIndex===i&&
     Number.isInteger(x.itemId)&&x.itemId>=1&&x.itemId<=0x53))
   return scripts.items.map(({hiddenIndex,mapId,y,x,itemId})=>({hiddenIndex,mapId,y,x,itemId}));
 if(!ROM_COORDS[hash])return null;
 const bytes=Buffer.from(HIDDEN_ITEM_COORDINATES_B64,'base64');
 if(bytes.length!==163||bytes[162]!==255)return null;
 const coords=[];
 for(let i=0;i<54;i++){
   const at=3*i;
   coords.push({hiddenIndex:i,mapId:bytes[at],y:bytes[at+1],x:bytes[at+2]});
 }
 return coords;
}
// RAM D6F0 é o bitmap de itens ocultos; o ordinal é a posição na tabela
// HiddenItemCoords de pret/pokered, comparada byte a byte nas 3 ROMs fornecidas.
function decodeHiddenItems(profile,mapId,hiddenHex,itemNames=null){
 const coords=fromKnownRom(profile),flags=parseHex(hiddenHex,14);
 if(!coords||!flags)return {verified:false,items:[],
    reason:!coords?'ROM não registada nesta tabela de itens ocultos':
      'Flags RAM D6F0 incompletas'};
 if(coords.some(x=>!Number.isInteger(x.itemId))&&HIDDEN_ITEM_IDS_HEX.length!==108)
  return {verified:false,items:[],reason:'IDs de itens ocultos corrompidos'};
 return {verified:true,mapId,
  source:'ROM HiddenItemCoords + ROM HiddenEventScripts + RAM wObtainedHiddenItemsFlags',
  items:coords.filter(x=>x.mapId===mapId).map(x=>{
    const itemId=Number.isInteger(x.itemId)?x.itemId:
      parseInt(HIDDEN_ITEM_IDS_HEX.slice(x.hiddenIndex*2,x.hiddenIndex*2+2),16);
    return {...x,itemId,
      itemName:itemNames?.[itemId]||'Item #'+itemId,
      itemNameSource:itemNames?.[itemId]?
        'ID_EXTRAÍDO_DA_ROM_NOME_DE_REFERÊNCIA':'ID_EXTRAÍDO_DA_ROM_SEM_NOME',
      isCollected:!!(flags[x.hiddenIndex>>3]&(1<<(x.hiddenIndex&7))),
      collectionEvidence:'COORDENADA_ROM + ITEM_ID_SCRIPT_ROM + FLAG_RAM',
      accessible:null
    };
  })};
}

// Os 12 eventos de moedas escondidas do Game Corner usam D6FE e não o
// bitmap D6F0 dos itens. O backup está limitado a 3 SHA-256 auditados.
const AUDITED_HIDDEN_COINS_B64='hwgACocQAQqHCwMUhw4DCocMBAqHDAkUhw8JCocOEAqHEAoKhwcLKIcID2SHDwwK';
function decodeHiddenCoins(profile,mapId,coinHex){
 const sha=profile?.hash?.sha256?.toLowerCase();
 let coins=null,source=null;
 const scripts=profile?.world?.hiddenItemScripts;
 if(scripts?.valid && scripts.sha256?.toLowerCase()===sha &&
    scripts.hiddenCoins?.valid && Array.isArray(scripts.hiddenCoins.coins) &&
    scripts.hiddenCoins.coins.length===12){
   coins=scripts.hiddenCoins.coins;
   source='ROM_HIDDEN_COIN_EVENTS_EXTRACTED';
 }else if(ROM_COORDS[sha]){
   const data=Buffer.from(AUDITED_HIDDEN_COINS_B64,'base64');
   if(data.length===48){
     coins=Array.from({length:12},(_,i)=>({
       hiddenIndex:i,mapId:data[i*4],y:data[i*4+1],
       x:data[i*4+2],coinAmount:data[i*4+3],
       actualAwardIfClaimed:data[i*4+3]===40?20:data[i*4+3]
     }));
     source='ROM_HIDDEN_COINS_AUDITED_THREE_BUILDS';
   }
 }
 const flags=parseHex(coinHex,2);
 if(!coins||!flags)return {verified:false,coins:[],
   reason:!coins?'ROM de moedas escondidas não descodificada':'Flags RAM D6FE indisponíveis'};
 if(coins.some((v,i)=>v.hiddenIndex!==i||!Number.isInteger(v.coinAmount)||
     ![10,20,40,100].includes(v.coinAmount)))return {
   verified:false,coins:[],reason:'Estrutura inválida de moedas escondidas'};
 return {verified:true,source:source+' + RAM_D6FE',mapId,
   coins:coins.filter(c=>c.mapId===mapId).map(c=>({
     ...c,
     actualAwardIfClaimed:Number.isInteger(c.actualAwardIfClaimed)?
       c.actualAwardIfClaimed:null,
     isCollected:!!(flags[c.hiddenIndex>>3]&(1<<(c.hiddenIndex&7))),
     collectionEvidence:'ID_EVENTO_ROM + FLAG_RAM_D6FE',
     amountSource:'ROM_ARG+ROTINA_DE_ATRIBUIÇÃO_SE_VALIDADA'
   }))};
}
module.exports={decodeToggleables,decodeHiddenItems,decodeHiddenCoins,fromKnownRom};
