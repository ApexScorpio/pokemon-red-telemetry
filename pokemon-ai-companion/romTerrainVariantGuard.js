'use strict';
// Bind all 226 terrain matrices to the exact audited ROM variant before
// giving geometric route hints. Red/Blue agree; Green differs on 226/227/228.
// Comparing per-map fingerprints is NOT a new SHA read from the active emulator.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const archives={
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b':
   require('./data/romTerrain_red.json'),
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d':
   require('./data/romTerrain_blue.json'),
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db':
   require('./data/romTerrain_green.json')
};
const fail=(reason,mapId=null)=>({verified:false,reason,mapId,
  verifiedMapCount:0,activeRomFullSha256Verified:false});
function verifyTerrainVariant(profile){
 const sha=String(profile?.hash?.sha256||'').toLowerCase();
 const actual=profile?.world?.terrainAtlas,expected=archives[sha];
 if(!isKnownAuditedRomSha(sha)||profile?.unknownLayout===true||
    actual?.verified!==true||actual.romSha256!==sha||
    expected?.verified!==true||expected.romSha256!==sha||
    !Array.isArray(actual.maps)||actual.maps.length!==226||
    !Array.isArray(expected.maps)||expected.maps.length!==226)
   return fail('Arquivo e perfil de 226 terrenos não vinculados ao mesmo SHA ROM');
 const reference=new Map();
 for(const m of expected.maps){
   if(!Number.isInteger(m?.mapId)||m.mapId<0||m.mapId>=248||
      reference.has(m.mapId))return fail('Arquivo ROM contém mapa duplicado');
   reference.set(m.mapId,m);
 }
 const seen=new Set();let cells=0;
 for(const m of actual.maps){
   const other=reference.get(m?.mapId);
   if(!other||seen.has(m.mapId)||m.width!==other.width||
      m.height!==other.height||m.tilesetId!==other.tilesetId||
      m.numberOfCells!==other.numberOfCells||
      m.tileIdsSha256!==other.tileIdsSha256||
      m.walkingBitsSha256!==other.walkingBitsSha256||
      m.blockDataSha256!==other.blockDataSha256||
      JSON.stringify(m.landBlockedTilePairs)!==
        JSON.stringify(other.landBlockedTilePairs))
     return fail('Matriz de terreno não corresponde ao arquivo SHA desta ROM',
       m?.mapId??null);
   seen.add(m.mapId);cells+=m.numberOfCells;
 }
 if(seen.size!==226||cells!==95132)
   return fail('Mapa ou contagem de células original divergente');
 return {verified:true,romSha256:sha,
   verifiedMapCount:226,verifiedTerrainCells:cells,
   source:'SHA256_PER_MAP_ARCHIVE_MATCH_ON_3_AUDITED_LOCAL_ROMS',
   fullRomFilesReReadNow:false,activeRomFullSha256Verified:false,
   runtimeAccessProven:false,
   note:'As 226 matrizes correspondem ao arquivo da variante; não certifica scripts, atores ou movimento real.'};
}
module.exports={verifyTerrainVariant};
