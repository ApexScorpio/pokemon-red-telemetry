'use strict';
// Independent, SHA-bound, read-only evidence for the uploaded Green (U) [p1][!]
// variant. This is NOT the previously audited Green International 1.2.1.
// It does not authorize use of English text decoding, terrain, battle,
// event flags, or live-game access rules for this different ROM.
const crypto=require('node:crypto');
const ROM_SHA256='5f31568f93c9d238b25e8f0f21e0f70dd1e20279065ff4d359d6147b8b692eeb';
const POINTERS=0x1bcb,BANKS=0xc883,BANK_SIZE=0x4000,MAPS=248;
const firstDims=[[9,10],[18,20],[18,20],[18,20],[9,10],
  [18,20],[18,25],[18,20],[9,10],[9,10],[18,20]];
const expected={mapCount:226,warps:813,signs:204,
  npc:472,trainer:334,item:106,wildPokemon:12};
const invalid=reason=>({verified:false,reason,liveCompanionSupported:false,
  textSemanticsVerified:false,accessVerified:false,scriptEffectsVerified:false});
const word=(b,p)=>b[p]|(b[p+1]<<8);
const at=(bank,cpu)=>bank>0&&bank<64&&cpu>=0x4000&&cpu<0x8000?
  bank*BANK_SIZE+cpu-BANK_SIZE:null;
function inspectGreenP1Layout(rom){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576)
   return invalid('ROM incompleta ou inválida');
 const sha256=crypto.createHash('sha256').update(rom).digest('hex');
 if(sha256!==ROM_SHA256)return invalid('SHA da variante Green p1 não coincide');
 const pointers=Array.from({length:MAPS},(_,i)=>word(rom,POINTERS+i*2));
 if(pointers.some(x=>x<0x4000||x>=0x8000))
   return invalid('Tabela de ponteiros Green p1 inválida');
 for(let i=0;i<firstDims.length;i++){
   const p=at(rom[BANKS+i],pointers[i]);
   if(p===null||rom[p+1]!==firstDims[i][0]||
      rom[p+2]!==firstDims[i][1])
     return invalid('Cabeçalhos iniciais Green p1 inconsistentes');
 }
 const maps=[];
 const counts={mapCount:0,warps:0,signs:0,npc:0,trainer:0,
   item:0,wildPokemon:0};
 for(let id=0;id<MAPS;id++){
   const bank=rom[BANKS+id],p=at(bank,pointers[id]);
   const end=(bank+1)*BANK_SIZE;
   if(p===null||p+12>end)continue;
   const tileset=rom[p],height=rom[p+1],width=rom[p+2],
     connections=rom[p+9];
   if(tileset>24||height<1||height>80||width<1||width>80||
      connections>15)continue;
   const count=(connections&1)+((connections>>1)&1)+
     ((connections>>2)&1)+((connections>>3)&1);
   const objectPtrAt=p+10+11*count;
   if(objectPtrAt+2>end)continue;
   const blocks=at(bank,word(rom,p+3));
   if(blocks===null||blocks+height*width>end)continue;
   let q=at(bank,word(rom,objectPtrAt));
   if(q===null||q+2>=end)continue;
   q++;const warps=rom[q++];
   if(warps>64||q+4*warps>=end)continue;
   const warpDetails=[];
   for(let j=0;j<warps;j++){
     const y=rom[q++],x=rom[q++],destinationWarp=rom[q++],destinationMap=rom[q++];
     warpDetails.push({ordinal:j+1,x,y,destinationMap,destinationWarp,
       destinationRequiresRam:destinationMap===255,
       accessibleNow:null,source:'GREEN_U_P1_ROM_WARP_BYTES'});
   }
   const signs=rom[q++];
   if(signs>40||q+3*signs>=end)continue;
   const signDetails=[];
   for(let j=0;j<signs;j++){
     const y=rom[q++],x=rom[q++],textId=rom[q++];
     signDetails.push({ordinal:j+1,x,y,textId,
       textMeaningVerified:false,source:'GREEN_U_P1_ROM_SIGN_BYTES'});
   }
   const actorCount=rom[q++];
   if(actorCount>48)continue;
   const local={npc:0,trainer:0,item:0,wildPokemon:0};
   const actorDetails=[];
   let valid=true;
   for(let j=0;j<actorCount;j++){
     if(q+6>end){valid=false;break;}
     const spriteId=rom[q],yRaw=rom[q+1],xRaw=rom[q+2],
       movementByte=rom[q+3],facingByte=rom[q+4],textId=rom[q+5];
     q+=6;
     const extra=(textId&0x40)?2:(textId&0x80)?1:0;
     if(q+extra>end){valid=false;break;}
     const metadata=[...rom.subarray(q,q+extra)];
     const meta=extra?metadata[0]:null;q+=extra;
     const type=(textId&0x40)?
       (meta>=1&&meta<=190?'wildPokemon':'trainer'):
       (textId&0x80?'item':'npc');
     local[type]++;
     actorDetails.push({ordinal:j+1,type,spriteId,
       x:xRaw-4,y:yRaw-4,xRaw,yRaw,movementByte,facingByte,textId,
       metadata,completionVerified:false,accessibleNow:null,
       textMeaningVerified:false,source:'GREEN_U_P1_ROM_ACTOR_BYTES'});
   }
   if(!valid)continue;
   counts.mapCount++;counts.warps+=warps;counts.signs+=signs;
   for(const [key,value] of Object.entries(local))counts[key]+=value;
   maps.push({mapId:id,mapBank:bank,widthBlocks:width,
     heightBlocks:height,warpObjects:warps,signObjects:signs,
     npcObjects:local.npc,trainerObjects:local.trainer,
     visibleItemObjects:local.item,stationaryPokemonObjects:local.wildPokemon,
     staticObjects:{warps:warpDetails,signs:signDetails,actors:actorDetails,
       source:'SHA_BOUND_GREEN_U_P1_RAW_OBJECT_RECORDS',
       liveStateRead:false,conditionalAccessVerified:false},
     accessCurrentlyProven:false,scriptEffectsVerified:false});
 }
 if(Object.entries(expected).some(([k,v])=>counts[k]!==v))
   return invalid('Contagens estruturais Green p1 divergentes: '+JSON.stringify(counts));
 return {verified:true,romSha256:sha256,variant:'GREEN_U_P1',
   mapPointerTableOffset:POINTERS,mapBankTableOffset:BANKS,
   counts,maps,staticStructuresOnly:true,liveCompanionSupported:false,
   textSemanticsVerified:false,accessVerified:false,scriptEffectsVerified:false,
   source:'SHA_BOUND_GREEN_P1_ROM_MAP_HEADER_OBJECT_STRUCTURE'};
}
module.exports={inspectGreenP1Layout,ROM_SHA256};
