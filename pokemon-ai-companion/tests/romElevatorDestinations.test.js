'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {auditElevatorDestinations}=require('../romElevatorDestinations');
const {readRom}=require('../romComprehensiveAudit');
const atlasFile=process.env.POKEGUIDE_ATLAS_JSON,dir=process.env.POKEMON_ROM_DIR;
const files={red:process.env.POKEMON_RED_ROM||(dir&&path.join(dir,'Pokemon - Red Version (UE)[!].zip')),
 blue:process.env.POKEMON_BLUE_ROM||(dir&&path.join(dir,'Pokemon Blue.gb')),
 green:process.env.POKEMON_GREEN_ROM||(dir&&path.join(dir,'Pokemon%20Green%20International%20v1.2.1.gb'))};
const ready=Boolean(atlasFile&&fs.existsSync(atlasFile)&&Object.values(files).every(p=>p&&fs.existsSync(p)));
test('tampered and unknown ROM cannot pretend to expose elevator floors',()=>{
 const rom=Buffer.alloc(1048576),maps={valid:true,data:Array.from({length:248},(_,mapId)=>({mapId,valid:true,objects:{warps:[]}}))};
 assert.equal(auditElevatorDestinations(rom,{maps}).verified,false);
});
for(const name of Object.keys(files))test('real '+name+' 19 menu floor destinations read directly and checked against map warps',
 {skip:!ready?'3 ROMs + atlas required':false},()=>{
  const atlas=JSON.parse(fs.readFileSync(atlasFile,'utf8')).variants[name];
  const data=auditElevatorDestinations(readRom(files[name]),{maps:{valid:true,data:atlas.catalogue.maps}});
  assert.equal(data.verified,true,data.reason);assert.equal(data.totalElevators,3);
  assert.equal(data.totalMenuFloorChoices,19);
  assert.deepEqual(data.elevators.map(x=>x.availableFloorOptions.length),[5,3,11]);
  assert.equal(data.elevators.find(x=>x.mapId===236).availableFloorOptions[0].destinationMapId,181);
  assert.equal(data.elevators.find(x=>x.mapId===236).availableFloorOptions.at(-1).destinationMapId,235);
  assert.equal(data.elevators.every(x=>x.currentFloorFromRamVerified===false),true);
 });