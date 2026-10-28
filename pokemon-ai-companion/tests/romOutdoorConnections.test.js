'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {extractOutdoorConnections}=require('../romOutdoorConnections');
const {readRom}=require('../romComprehensiveAudit');
const source=process.env.POKEGUIDE_ATLAS_JSON;
const dir=process.env.POKEMON_ROM_DIR;
const files={red:process.env.POKEMON_RED_ROM||(dir&&path.join(dir,'Pokemon - Red Version (UE)[!].zip')),
 blue:process.env.POKEMON_BLUE_ROM||(dir&&path.join(dir,'Pokemon Blue.gb')),
 green:process.env.POKEMON_GREEN_ROM||(dir&&path.join(dir,'Pokemon%20Green%20International%20v1.2.1.gb'))};
const ready=Boolean(source&&fs.existsSync(source)&&Object.values(files).every(f=>f&&fs.existsSync(f)));
test('unknown ROM or invalid map index refuses outdoor routes',()=>{
 const p=extractOutdoorConnections(Buffer.alloc(1048576),{valid:true,data:Array.from({length:248},(_,i)=>({mapId:i,valid:false}))});
 assert.equal(p.verified,false);
 assert.equal(extractOutdoorConnections(Buffer.alloc(0),{valid:false}).verified,false);
});
for(const name of Object.keys(files))test('all 78 original '+name+' border links reciprocal and ROM-byte-backed',
 {skip:!ready?'Three ROM files and generated atlas required':false},()=>{
  const maps=JSON.parse(fs.readFileSync(source,'utf8')).variants[name].catalogue.maps;
  const report=extractOutdoorConnections(readRom(files[name]),{valid:true,data:maps});
  assert.equal(report.verified,true,report.reason);
  assert.equal(report.edgeCount,78);assert.equal(report.reciprocalConnections,78);
  assert.equal(report.runtimeAccessibilityVerified,false);
  assert.ok(report.edges.some(e=>e.sourceMapId===0&&e.direction==='north'&&e.destinationMapId===12));
  assert.ok(report.edges.some(e=>e.sourceMapId===0&&e.direction==='south'&&e.destinationMapId===32));
  assert.equal(report.edges.every(e=>e.descriptorSize===11),true);
 });