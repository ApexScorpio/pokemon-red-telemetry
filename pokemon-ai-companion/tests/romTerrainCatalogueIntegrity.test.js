'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {inspectTerrainCell,findTerrainRoute}=require('../romTerrainAtlas');
const KNOWN={red:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 blue:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 green:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const variant of Object.keys(KNOWN))test(variant+' derived catalogue is internally consistent in all 226 map matrices',()=>{
 const t=require('../data/romTerrain_'+variant+'.json');
 assert.equal(t.verified,true);assert.equal(t.romSha256,KNOWN[variant]);
 assert.equal(t.tilesets.length,24);assert.equal(t.landTilePairs.length,11);assert.equal(t.waterTilePairs.length,3);
 assert.equal(t.maps.length,226);
 const byId=new Set();let cellCount=0,walkable=0;
 for(const m of t.maps){
  assert.ok(Number.isInteger(m.mapId)&&m.mapId>=0&&m.mapId<248&&!byId.has(m.mapId));
  byId.add(m.mapId);
  const ids=Buffer.from(m.tileIdsBase64,'base64'),bits=Buffer.from(m.walkingBitsBase64,'base64');
  assert.equal(ids.length,m.numberOfCells);assert.equal(m.numberOfCells,m.width*m.height);
  assert.equal(bits.length,Math.ceil(ids.length/8));
  assert.equal(sha(ids),m.tileIdsSha256);assert.equal(sha(bits),m.walkingBitsSha256);
  const pass=new Set(t.tilesets[m.tilesetId].walkableTileIds);
  let count=0;
  for(let i=0;i<ids.length;i++){
   assert.ok(ids[i]<0x60);
   const actual=Boolean(bits[i>>3]&(1<<(i&7)));
   assert.equal(actual,pass.has(ids[i]));if(actual)count++;
  }
  assert.equal(count,m.landTerrainWalkableCells);
  const pairs=t.landTilePairs.filter(p=>p.tilesetId===m.tilesetId).map(p=>[p.tile1,p.tile2]);
  assert.deepEqual(m.landBlockedTilePairs,pairs);
  assert.equal(inspectTerrainCell(m,0,0).verified,true);
  cellCount+=ids.length;walkable+=count;
 }
 assert.equal(cellCount,95132);
 assert.equal(walkable,variant==='green'?48570:48504);
 assert.equal(t.totals.terrainCells,cellCount);
 assert.equal(t.totals.walkableLandTerrainCells,walkable);
});