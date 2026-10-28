'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {buildWarpGraph,findStaticWarpRoute,normalizedWarp}=require('../romWarpGraph');
const {readRom}=require('../romComprehensiveAudit');
const atlas=process.env.POKEGUIDE_ATLAS_JSON;
const local=process.env.POKEMON_ROM_DIR;
const paths={red:process.env.POKEMON_RED_ROM||(local&&path.join(local,'Pokemon - Red Version (UE)[!].zip')),
 blue:process.env.POKEMON_BLUE_ROM||(local&&path.join(local,'Pokemon Blue.gb')),
 green:process.env.POKEMON_GREEN_ROM||(local&&path.join(local,'Pokemon%20Green%20International%20v1.2.1.gb'))};
const hashes={red:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 blue:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 green:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'};
const ok=Boolean(atlas&&fs.existsSync(atlas)&&Object.values(paths).every(f=>f&&fs.existsSync(f)));
test('normalize raw binary reader field names and old atlas field names',()=>{
 assert.deepEqual(normalizedWarp({x:1,y:2,destinationMap:37,destinationWarp:3}),
   {x:1,y:2,destinationMap:37,destinationWarp:3});
 assert.deepEqual(normalizedWarp({x:1,y:2,map:37,warp:3}),
   {x:1,y:2,destinationMap:37,destinationWarp:3});
 assert.equal(normalizedWarp({x:-1,y:2,map:37,warp:3}),null);
});
test('unknown profile or malformed map list cannot invent navigation',()=>{
 assert.equal(buildWarpGraph({hash:{sha256:'0'.repeat(64)},world:{maps:{valid:true,data:[]}}}).verified,false);
 assert.equal(findStaticWarpRoute({verified:false},0,40).verified,false);
});
for(const name of Object.keys(paths))test('real ROM '+name+' all 226 map headers and 813 warp byte records match SHA-proven atlas',
 {skip:!ok?'Three original ROMs and POKEGUIDE_ATLAS_JSON required':false},()=>{
  const data=JSON.parse(fs.readFileSync(atlas,'utf8')).variants[name],buf=readRom(paths[name]);
  assert.equal(crypto.createHash('sha256').update(buf).digest('hex'),hashes[name]);
  assert.equal(data.identity.sha256,hashes[name]);
  const maps=data.catalogue.maps;
  const graph=buildWarpGraph({hash:{sha256:hashes[name]},world:{maps:{valid:true,data:maps}}});
  assert.equal(graph.verified,true,graph.reason);assert.equal(graph.normalMapHeaders,226);
  assert.equal(graph.totalWarpEntries,813);
  assert.equal(graph.statusCounts.STATIC_DESTINATION_WARP_VALIDATED,560);
  assert.equal(graph.statusCounts.LAST_MAP_RAM_REQUIRED,251);
  assert.equal(graph.statusCounts.SILPH_ELEVATOR_SCRIPT_PATCH_REQUIRED,2);
  let compared=0;
  for(const m of maps){
   if(!m.valid)continue;
   const bank=m.mapBank,p=bank*16384+m.mapHeaderPointerCpu-0x4000;
   const flag=buf[p+9],count=flag.toString(2).split('1').length-1;
   const ptr=buf.readUInt16LE(p+10+11*count);
   const start=bank*16384+ptr-0x4000,amount=buf[start+1];
   const source=m.objects.warps;assert.equal(source.length,amount,'map '+m.mapId);
   for(let i=0;i<amount;i++){
    const offset=start+2+4*i,dest=normalizedWarp(source[i]);
    assert.deepEqual([dest.y,dest.x,dest.destinationWarp,dest.destinationMap],
      [...buf.subarray(offset,offset+4)],name+' map '+m.mapId+' warp '+i);
    compared++;
   }
  }
  assert.equal(compared,813);
  const route=findStaticWarpRoute(graph,0,40);assert.equal(route.verified,true);
  assert.equal(route.hopCount,1);
  assert.equal(route.routeNavigableNowProven,false);
  assert.equal(findStaticWarpRoute(graph,40,0).pathUnavailableIsNotUnreachable,true);
 });