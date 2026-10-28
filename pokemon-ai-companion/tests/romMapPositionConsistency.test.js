'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifyMapPositionWindow}=require('../romMapPositionConsistency');
const example={firstMapByte:'0C',firstYByte:'12',firstXByte:'04',
 secondMapAndLastMapBytes:['0C','00','00','12','04','00','00','01']};
test('coherent map, coordinates and last map are accepted without atomic claim',()=>{
 const r=verifyMapPositionWindow(example);
 assert.equal(r.verified,true);assert.equal(r.mapId,12);
 assert.equal(r.x,4);assert.equal(r.y,18);assert.equal(r.lastMapId,1);
 assert.equal(r.atomicSnapshotVerified,false);
 assert.equal(r.mapAndCoordinatesCorroborated,true);
});
test('same map but moved between reads must not be used for live guidance',()=>{
 const r=verifyMapPositionWindow({...example,secondMapAndLastMapBytes:
  ['0C','00','00','13','04','00','00','01']});
 assert.equal(r.verified,false);assert.equal(r.reason,'POSICAO_MUDOU_DURANTE_LEITURA');
 assert.equal(r.mapAndCoordinatesCorroborated,false);
});
test('same map but changed X is also rejected',()=>{
 assert.equal(verifyMapPositionWindow({...example,secondMapAndLastMapBytes:
  ['0C','00','00','12','05','00','00','01']}).verified,false);
});
test('map changed but location unchanged is rejected',()=>{
 const r=verifyMapPositionWindow({...example,secondMapAndLastMapBytes:
  ['0D','00','00','12','04','00','00','01']});
 assert.equal(r.verified,false);assert.equal(r.reason,'MAPA_MUDOU_DURANTE_LEITURA');
});
test('incomplete, non-hex and wrong-position samples are never inferred',()=>{
 for(const input of [[],['0C'],Array(8).fill('ZZ'),[...example.secondMapAndLastMapBytes.slice(0,7),'XY'],null]){
  assert.equal(verifyMapPositionWindow({...example,secondMapAndLastMapBytes:input}).verified,false);
 }
 assert.equal(verifyMapPositionWindow({...example,firstXByte:'5'}).verified,false);
});
test('map 248 outside indexed Gen I map IDs is refused',()=>{
 const a=verifyMapPositionWindow({...example,firstMapByte:'F8',secondMapAndLastMapBytes:
  ['F8','00','00','12','04','00','00','01']});
 assert.equal(a.verified,false);assert.equal(a.reason,'ID_MAPA_FORA_DE_0_247');
});
