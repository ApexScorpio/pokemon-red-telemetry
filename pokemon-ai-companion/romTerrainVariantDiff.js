'use strict';
// Diff of static land-passability, not a claim about live traversal.
const crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const allowed={
 red:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 blue:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 green:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'};
function compareTerrainVariants(a,b){
 if(a?.verified!==true||b?.verified!==true||
   allowed[a.version]!==a.romSha256||allowed[b.version]!==b.romSha256||
   a.version===b.version||!Array.isArray(a.maps)||!Array.isArray(b.maps)||
   a.maps.length!==226||b.maps.length!==226)
  return {verified:false,reason:'Versões exatas ou 226 mapas não comprovados'};
 const byB=new Map(b.maps.map(m=>[m.mapId,m])),maps=[];
 let changed=0,added=0,removed=0;
 for(const m of a.maps){
  const n=byB.get(m.mapId);
  if(!n||m.width!==n.width||m.height!==n.height||m.numberOfCells!==n.numberOfCells)
   return {verified:false,reason:'Mapa inexistente ou geometria incompatível #'+m.mapId};
  const mb=Buffer.from(m.walkingBitsBase64,'base64'),nb=Buffer.from(n.walkingBitsBase64,'base64');
  if(mb.length!==Math.ceil(m.numberOfCells/8)||nb.length!==mb.length||
     sha(mb)!==m.walkingBitsSha256||sha(nb)!==n.walkingBitsSha256)
   return {verified:false,reason:'Bitmaps não coincidem com os hashes do mapa #'+m.mapId};
  let gain=0,loss=0;const cells=[];
  for(let i=0;i<m.numberOfCells;i++){
   const yesA=Boolean(mb[i>>3]&(1<<(i&7))),yesB=Boolean(nb[i>>3]&(1<<(i&7)));
   if(yesA===yesB)continue;
   if(!yesA)gain++;else loss++;
   cells.push({x:i%m.width,y:Math.floor(i/m.width),
      walkableInA:yesA,walkableInB:yesB});
  }
  if(cells.length){
   maps.push({mapId:m.mapId,width:m.width,height:m.height,
      passableAddedInB:gain,passableRemovedInB:loss,cellsChanged:cells.length,
      affectedCells:cells,actualTraversalChangedProven:false});
   changed+=cells.length;added+=gain;removed+=loss;
  }
 }
 const combo=[a.version,b.version].sort().join('/');
 const expect=combo==='blue/red'?[0,0,0,0]:[642,354,288,3];
 // Compare Green/Red-BLUE in the A->B direction, which reverses addition/loss.
 const norm= b.version==='green'||(a.version==='red'&&b.version==='blue')||
   (a.version==='blue'&&b.version==='red')?[changed,added,removed,maps.length]:
   [changed,removed,added,maps.length];
 if(norm.some((n,i)=>n!==expect[i]))return {verified:false,reason:'As diferenças não coincidem com as três ROMs auditadas',
   observed:{changed,added,removed,affectedMaps:maps.length}};
 return {verified:true,firstVersion:a.version,secondVersion:b.version,
   firstRomSha256:a.romSha256,secondRomSha256:b.romSha256,
   cellsChanged:changed,passableAddedInSecond:added,
   passableRemovedInSecond:removed,netAdditionalWalkableInSecond:added-removed,
   affectedMapIds:maps.map(x=>x.mapId),maps,
   actualTraversalChangedProven:false,
   source:'DIFF_OF_226_ORIGINAL_SHA_VERIFIED_TERRAIN_GRIDS'};
}
module.exports={compareTerrainVariants};