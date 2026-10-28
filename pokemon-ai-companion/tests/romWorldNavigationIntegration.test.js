'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {readRom}=require('../romComprehensiveAudit');
const {extractOutdoorConnections}=require('../romOutdoorConnections');
const {buildWarpGraph,findStaticWarpRoute}=require('../romWarpGraph');
const atlasFile=process.env.POKEGUIDE_ATLAS_JSON,dir=process.env.POKEMON_ROM_DIR;
const files={red:process.env.POKEMON_RED_ROM||(dir&&path.join(dir,'Pokemon - Red Version (UE)[!].zip')),
 blue:process.env.POKEMON_BLUE_ROM||(dir&&path.join(dir,'Pokemon Blue.gb')),
 green:process.env.POKEMON_GREEN_ROM||(dir&&path.join(dir,'Pokemon%20Green%20International%20v1.2.1.gb'))};
const ready=atlasFile&&fs.existsSync(atlasFile)&&Object.values(files).every(f=>f&&fs.existsSync(f));
for(const name of ['red','blue','green']){
 test('ROM '+name+' navigation integrates all 813 warp edges + 78 borders, Pallet → Route 1',
  {skip:!ready?'Original ROMs and atlas required':false},()=>{
  const atlas=JSON.parse(fs.readFileSync(atlasFile,'utf8')).variants[name],buf=readRom(files[name]);
  const profile={hash:{sha256:atlas.identity.sha256},world:{maps:{valid:true,data:atlas.catalogue.maps}}};
  profile.world.outdoorConnections=extractOutdoorConnections(buf,profile.world.maps);
  const graph=buildWarpGraph(profile);
  assert.equal(graph.verified,true,graph.reason);
  assert.equal(graph.outdoorHeaderConnectionsDecoded,true);
  assert.equal(graph.outdoorConnectionCount,78);
  const pathInfo=findStaticWarpRoute(graph,0,12);
  assert.equal(pathInfo.verified,true);
  assert.equal(pathInfo.hopCount,1);
  assert.equal(pathInfo.includesOutdoorConnections,true);
  assert.equal(pathInfo.routeNavigableNowProven,false);
  assert.equal(pathInfo.edges[0].direction,'north');
  assert.equal(pathInfo.edges[0].destinationMapId,12);
 });
}