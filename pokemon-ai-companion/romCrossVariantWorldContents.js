'use strict';
// Compare decoded world OBJECT RECORDS across audited Gen I ROMs, not merely
// matching coverage counters. Parsed attributes are not runtime behavior.
const {AUDITED_ROM_SHA256}=require('./romKnownSha256');
const SHA={RED:AUDITED_ROM_SHA256.RED,BLUE:AUDITED_ROM_SHA256.BLUE,
 GREEN:AUDITED_ROM_SHA256.GREEN_INTERNATIONAL_1_2_1};
const IDS=248,NORMAL=226;
const TYPES=['geometry','visibleItems','hiddenItems','trainers','npcs',
 'stationaryPokemon','signs','warps','unassignedHiddenItems'];
const ACTORS={visibleItems:'item',trainers:'trainer',npcs:'npc',
 stationaryPokemon:'wildPokemon'};
const fail=reason=>({verified:false,reason,mapsCompared:0,
 differingMaps:[],equalDecodedMaps:0,decodedMapDifferences:0,
 gameplayEquivalent:null,gameplayCompletionCertified:false});
const byte=x=>Number.isInteger(x)&&x>=0&&x<=255;
const coord=x=>Number.isInteger(x)&&x>=-4&&x<=255;
const integerOrNull=x=>x===null||Number.isSafeInteger(x)&&x>=0;
const unknown=x=>x?.accessibleNow===null&&x.collected===null&&
 x.completed===null&&x.needsCut===null&&x.needsSurf===null;
function captureList(items,key){
 if(!Array.isArray(items))return null;
 const seen=new Set(),out=[];
 for(const e of items){
  if(!e||!Number.isInteger(e.ordinal)&&key!=='hiddenItems'&&
     key!=='unassignedHiddenItems')return null;
  if(key==='hiddenItems'||key==='unassignedHiddenItems'){
   if(!Number.isSafeInteger(e.hiddenIndex)||e.hiddenIndex<0||
      e.hiddenIndex>=54||!byte(e.x)||!byte(e.y)||!byte(e.itemId)||
      !unknown(e))return null;
   if(key==='unassignedHiddenItems'&&
      (!byte(e.mapId)||e.scriptBindingVerified!==null||
       e.mapReferenceStatus!=='NO_NORMAL_MAP_HEADER'))return null;
   if(seen.has(e.hiddenIndex))return null;
   seen.add(e.hiddenIndex);
   out.push([e.hiddenIndex,e.x,e.y,e.itemId]);
  }else if(key==='warps'){
   if(!Number.isSafeInteger(e.ordinal)||e.ordinal<=0||
      !coord(e.x)||!coord(e.y)||!byte(e.destinationMap)||
      !byte(e.destinationWarp)||
      e.destinationDynamic!==(e.destinationMap===255)||
      e.source!=='ROM_MAP_WARP_BYTES'||!unknown(e))return null;
   if(seen.has(e.ordinal))return null;
   seen.add(e.ordinal);
   out.push([e.ordinal,e.x,e.y,e.destinationMap,e.destinationWarp]);
  }else if(key==='signs'){
   if(!Number.isSafeInteger(e.ordinal)||e.ordinal<=0||
      !coord(e.x)||!coord(e.y)||!byte(e.textId)||
      e.textMeaningVerified!==false||
      e.source!=='ROM_MAP_SIGN_BYTES'||!unknown(e))return null;
   if(seen.has(e.ordinal))return null;
   seen.add(e.ordinal);
   out.push([e.ordinal,e.x,e.y,e.textId]);
  }else{
   if(e.kind!==ACTORS[key]||e.source!=='ROM_MAP_OBJECT_BYTES'||
      !Number.isSafeInteger(e.ordinal)||e.ordinal<=0||
      !byte(e.spriteId)||!byte(e.textId)||
      !Number.isInteger(e.x)||e.x< -4||e.x>255||
      !Number.isInteger(e.y)||e.y< -4||e.y>255||
      !integerOrNull(e.itemOrTrainerId)||
      !integerOrNull(e.trainerNumberOrLevel)||
      !integerOrNull(e.wildSpeciesInternalId)||
      !integerOrNull(e.wildLevel)||!unknown(e))return null;
   if(seen.has(e.ordinal))return null;
   seen.add(e.ordinal);
   out.push([e.ordinal,e.kind,e.x,e.y,e.spriteId,e.textId,
    e.itemOrTrainerId,e.trainerNumberOrLevel,
    e.wildSpeciesInternalId,e.wildLevel]);
  }
 }
 return out;
}
function project(index,variant){
 if(index?.verified!==true||
    index.romSha256!==SHA[variant]||
    index.source!=='SHA_AUDITED_ROM_PROFILE_ALL_MAP_HEADERS_AND_OBJECT_RECORDS'||
    index.hiddenItemCoordinatesVerified!==true||
    index.runtimeStateVerified!==false||
    index.totalMapsWithLiveCompletionVerified!==0||
    !Array.isArray(index.maps)||index.maps.length!==IDS||
    index.totals?.normalMaps!==NORMAL||
    index.totals?.reservedOrUnresolvedMapIds!==IDS-NORMAL||
    index.totals?.hiddenItems!==54||
    index.totals?.hiddenItemsInNormalMaps+
      index.totals?.hiddenItemsWithoutNormalHeader!==54)return null;
 const totals={normalMaps:0,reservedOrUnresolvedMapIds:0,
  visibleItems:0,hiddenItems:0,hiddenItemsInNormalMaps:0,
  hiddenItemsWithoutNormalHeader:0,trainers:0,npcs:0,
  stationaryPokemon:0,signs:0,warps:0};
 const rows=[];const globalHidden=new Set();
 for(let id=0;id<IDS;id++){
  const map=index.maps[id];
  if(!map||map.mapId!==id)return null;
  if(map.verified!==true){
   if(map.verified!==false||map.status!=='NO_NORMAL_MAP_HEADER'||
      map.contents!==null||!Array.isArray(map.unassignedHiddenItems))return null;
   const hidden=captureList(map.unassignedHiddenItems,'unassignedHiddenItems');
   if(hidden===null)return null;
   for(const h of hidden){if(globalHidden.has(h[0]))return null;globalHidden.add(h[0]);}
   totals.reservedOrUnresolvedMapIds++;
   totals.hiddenItemsWithoutNormalHeader+=hidden.length;
   rows.push({mapId:id,normal:false,geometry:null,unassignedHiddenItems:hidden});
   continue;
  }
  if(map.status!=='ROM_STATIC_CONTENTS'||!map.contents||
     !Number.isInteger(map.widthBlocks)&&map.widthBlocks!==null||
     !Number.isInteger(map.heightBlocks)&&map.heightBlocks!==null)
   return null;
  const row={mapId:id,normal:true,
   geometry:[map.widthBlocks??null,map.heightBlocks??null],
   unassignedHiddenItems:[]};
  totals.normalMaps++;
  for(const key of TYPES.filter(t=>t!=='geometry'&&t!=='unassignedHiddenItems')){
   const data=captureList(map.contents[key],key);
   if(data===null)return null;
   row[key]=data;
   totals[key]+=data.length;
   if(key==='hiddenItems'){
    totals.hiddenItemsInNormalMaps+=data.length;
    for(const h of data){if(globalHidden.has(h[0]))return null;globalHidden.add(h[0]);}
   }
  }
  rows.push(row);
 }
 totals.hiddenItems+=totals.hiddenItemsWithoutNormalHeader;
 if(globalHidden.size!==54||Object.entries(totals).some(([name,n])=>
     index.totals[name]!==n)||index.unassignedHiddenItems?.length!==
      totals.hiddenItemsWithoutNormalHeader)return null;
 return rows;
}
function compareCrossVariantWorldContents({red,blue,green}={}){
 const groups={RED:project(red,'RED'),BLUE:project(blue,'BLUE'),
  GREEN:project(green,'GREEN')};
 if(Object.values(groups).some(x=>x===null))
  return fail('Exact audited SHA and 248 decoded object rows are required');
 const differingMaps=[],totals=Object.fromEntries(TYPES.map(k=>[k,0]));
 for(let id=0;id<IDS;id++){
  const a=groups.RED[id],b=groups.BLUE[id],c=groups.GREEN[id];
  const categories=[];
  if(a.normal!==b.normal||a.normal!==c.normal)
   categories.push('mapHeaderStatus');
  for(const key of TYPES){
   const x=JSON.stringify(a[key]??null),y=JSON.stringify(b[key]??null),
    z=JSON.stringify(c[key]??null);
   if(x!==y||x!==z){categories.push(key);totals[key]++;}
  }
  if(categories.length){
   differingMaps.push({mapId:id,categories,
    recordCounts:Object.fromEntries(['RED','BLUE','GREEN'].map(variant=>
      [variant,Object.fromEntries(TYPES.filter(t=>t!=='geometry').map(key=>
        [key,groups[variant][id][key]?.length??null]))])),
    currentAccessProven:false,gameEffectProven:false});
  }
 }
 return {verified:true,
  source:'THREE_SHA_AUDITED_DECODED_MAP_OBJECT_CONTENTS_COMPARISON',
  romSha256:SHA,mapsCompared:IDS,
  equalDecodedMaps:IDS-differingMaps.length,
  decodedMapDifferences:differingMaps.length,
  perCategoryMapDifferences:totals,differingMaps,
  sameDecodedObjectRecords:differingMaps.length===0,
  gameplayEquivalent:null,gameplayCompletionCertified:false,
  warning:'Decoded object record equality is not binary ROM identity, walkability, field-move eligibility, or gameplay equivalence.'};
}
module.exports={compareCrossVariantWorldContents};
