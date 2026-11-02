'use strict';
// Cross-check the 78 compiled ROM border descriptors against the SHA-matched
// archive. Matching descriptors never proves spatial alignment or traversal.
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const CATALOGUE=require('./data/gen1OutdoorConnectionsAudited.json');
const FIELDS=['sourceMapId','destinationMapId','direction',
 'reverseDirection','sourceFileOffset','sourceBank','descriptorSize',
 'destinationBlockPointerCpu','destinationWidthBlocks'];
const fail=(reason)=>({verified:false,reason,sourceBorderCoordinatesProven:false});
const key=e=>e.sourceMapId+':'+e.direction+':'+e.destinationMapId;
function verifyOutdoorConnectionVariant({warpGraph,romSha256}={}){
 const sha=String(romSha256||'').toLowerCase();
 const reference=CATALOGUE.versions?.[sha];
 const candidate=warpGraph?.outdoorConnections;
 if(!isKnownAuditedRomSha(sha)||
    reference?.verified!==true||reference.romSha256!==sha||
    reference.edgeCount!==78||reference.reciprocalConnections!==78||
    !Array.isArray(reference.edges)||reference.edges.length!==78||
    warpGraph?.verified!==true||warpGraph.romSha256!==sha||
    candidate?.verified!==true||candidate.romSha256!==sha||
    candidate.edgeCount!==78||candidate.reciprocalConnections!==78||
    !Array.isArray(candidate.edges)||candidate.edges.length!==78)
   return fail('ROM, atlas ou 78 fronteiras não comprovados');
 const expected=new Map();
 for(const e of reference.edges){
   const k=key(e);
   if(expected.has(k)||e.descriptorSize!==11||
      e.pathAccessProven!==false||
      e.currentBorderCoordinatesProven!==false)
     return fail('Catálogo auditado de fronteiras inválido');
   expected.set(k,e);
 }
 const seen=new Set();
 for(const e of candidate.edges){
   const k=key(e),saved=expected.get(k);
   if(!saved||seen.has(k)||
      FIELDS.some(field=>e[field]!==saved[field]))
     return fail('Fronteira diferente do descritor original: '+k);
   seen.add(k);
 }
 if(seen.size!==78)return fail('Faltam descritores de fronteiras originais');
 return {verified:true,romSha256:sha,
   referenceEdgeCount:78,matchingDescriptors:78,
   sourceBorderCoordinatesProven:false,
   borderAlignmentVerified:false,
   currentTraversalProven:false,
   activeRomFullSha256Verified:false,
   source:'EXACT_78_ROM_HEADER_DESCRIPTORS_SHA_VARIANT_REFERENCE'};
}
module.exports={verifyOutdoorConnectionVariant};
