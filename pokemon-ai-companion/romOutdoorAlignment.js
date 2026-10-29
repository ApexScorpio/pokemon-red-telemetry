'use strict';
// Corroborate all 78 pret/pokered connection offsets with the original-ROM
// connection strip pointers and map header block pointers. No gameplay claim.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const OFFSETS=require('./data/gen1OutdoorConnectionOffsetsReference.json');
const ARCHIVE=require('./data/gen1OutdoorConnectionsAudited.json');
const invalid=reason=>({verified:false,reason,connections:[],
  sourceCoordinatesCorroborated:false,actualTransitionVerified:false});
const key=e=>e.sourceMapId+':'+e.direction+':'+e.destinationMapId;
const valid=x=>Number.isInteger(x)&&x>=0&&x<248;
function expectedBlockOffset(direction,offset,destWidth,destHeight){
 const target=offset+3,source=target<2?-target:0;
 switch(direction){
   case 'north':return destWidth*(destHeight-3)+source;
   case 'south':return source;
   case 'west':return destWidth*source+destWidth-3;
   case 'east':return destWidth*source;
   default:return null;
 }
}
function mapArrival(direction,offsetBlocks,sourceTile,destinationWidth,destinationHeight){
 if(!Number.isInteger(sourceTile?.x)||!Number.isInteger(sourceTile?.y)||
    !Number.isInteger(offsetBlocks)||!Number.isInteger(destinationWidth)||
    !Number.isInteger(destinationHeight))return null;
 const shift=offsetBlocks*2;
 const x=direction==='north'||direction==='south'?
   sourceTile.x-shift:direction==='west'?destinationWidth-1:
   direction==='east'?0:null;
 const y=direction==='east'||direction==='west'?
   sourceTile.y-shift:direction==='north'?destinationHeight-1:
   direction==='south'?0:null;
 if(x===null||y===null||x<0||y<0||
    x>=destinationWidth||y>=destinationHeight)return null;
 return {x,y};
}
function validateOutdoorAlignment({profile,warpGraph}={}){
 const sha=String(profile?.hash?.sha256||'').toLowerCase();
 const index=profile?.world?.maps;
 const archive=ARCHIVE.versions?.[sha],outdoors=warpGraph?.outdoorConnections;
 if(!isKnownAuditedRomSha(sha)||profile?.unknownLayout===true||
    index?.valid!==true||!Array.isArray(index.data)||index.data.length!==248||
    index.data.some((m,i)=>m?.mapId!==i)||
    index.data.filter(m=>m.valid===true).length!==226||
    warpGraph?.verified!==true||warpGraph.romSha256!==sha||
    archive?.verified!==true||archive.romSha256!==sha||
    archive.edgeCount!==78||archive.reciprocalConnections!==78||
    outdoors?.verified!==true||outdoors.romSha256!==sha||
    outdoors.edgeCount!==78||outdoors.reciprocalConnections!==78||
    !Array.isArray(outdoors.edges)||outdoors.edges.length!==78||
    OFFSETS.edgeCount!==78||OFFSETS.sourceMaps!==36||
    !Array.isArray(OFFSETS.edges)||OFFSETS.edges.length!==78)
   return invalid('Identidade de ROM/mapas ou os 78 descritores ainda não estão comprovados');
 const refs=new Map();
 for(const edge of OFFSETS.edges){
   if(!valid(edge.sourceMapId)||!valid(edge.destinationMapId)||
      !Number.isInteger(edge.offsetBlocks)||Math.abs(edge.offsetBlocks)>100||
      refs.has(key(edge)))return invalid('Referência pret de deslocamentos incoerente');
   refs.set(key(edge),edge);
 }
 const byArchive=new Map(archive.edges.map(e=>[key(e),e]));
 const seen=new Set(),result=[];
 for(const e of outdoors.edges){
   const k=key(e),ref=refs.get(k),known=byArchive.get(k);
   if(seen.has(k)||!ref||!known||!valid(e.destinationMapId)||
      e.destinationMapId!==known.destinationMapId||
      e.sourceFileOffset!==known.sourceFileOffset||
      e.destinationBlockPointerCpu!==known.destinationBlockPointerCpu||
      e.destinationWidthBlocks!==known.destinationWidthBlocks)
     return invalid('Referência de ligação divergente: '+k);
   seen.add(k);
   const dest=index.data[e.destinationMapId],source=index.data[e.sourceMapId];
   if(!dest?.valid||!source?.valid||
      !Number.isInteger(dest.blocksPointerCpu)||
      !Number.isInteger(dest.widthBlocks)||!Number.isInteger(dest.heightBlocks)||
      dest.widthBlocks!==e.destinationWidthBlocks||
      !Number.isInteger(source.widthBlocks)||!Number.isInteger(source.heightBlocks))
     return invalid('Cabeçalho de blocos ROM incompleto: '+k);
   const offset=expectedBlockOffset(e.direction,ref.offsetBlocks,
     dest.widthBlocks,dest.heightBlocks);
   if(offset===null||
      ((dest.blocksPointerCpu+offset)&0xffff)!==e.destinationBlockPointerCpu)
     return invalid('Ponteiro de bloco não confirma deslocamento pret: '+k);
   result.push({sourceMapId:e.sourceMapId,destinationMapId:e.destinationMapId,
     direction:e.direction,offsetBlocks:ref.offsetBlocks,
     sourceFile:ref.sourceFile,
     sourceWidthTiles:source.widthBlocks*2,
     sourceHeightTiles:source.heightBlocks*2,
     destinationWidthTiles:dest.widthBlocks*2,
     destinationHeightTiles:dest.heightBlocks*2,
     descriptorPointerMatches:true,referenceOffsetCorroborated:true,
     gameCrossingObserved:false});
 }
 if(result.length!==78||seen.size!==78)
   return invalid('Correspondência de ligações incompleta');
 return {verified:true,romSha256:sha,connections:result,
   verifiedConnections:78,sourceMaps:36,
   descriptorPointerFormulaVerified:true,
   referenceOffsetCorroborated:true,
   sourceCoordinatesCorroborated:true,
   actualTransitionVerified:false,activeRomBinaryShaVerified:false,
   source:'PRET_MAP_CONNECTION_MACRO_AND_SHA_ROM_BLOCK_POINTER_CORROBORATION'};
}
module.exports={validateOutdoorAlignment,mapArrival,expectedBlockOffset};
