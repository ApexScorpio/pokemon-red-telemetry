'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {findGen1MoveTable}=require('../romMoveTable');
const BANK=16384;
function romWithTable(offset=1000){
 const bytes=Buffer.alloc(BANK*2);
 for(let i=0;i<165;i++){
  const p=offset+i*6;
  bytes[p]=i+1;bytes[p+1]=i%64;bytes[p+2]=i%100;
  bytes[p+3]=20;bytes[p+4]=i===0?255:216;bytes[p+5]=15;
 }
 return bytes;
}
test('extracts all 165 moves and exact byte provenance from ROM',()=>{
 const x=findGen1MoveTable(romWithTable());
 assert.equal(x.valid,true);assert.equal(x.offset,1000);
 assert.equal(x.rows.length,165);assert.equal(x.rows[0].id,1);
 assert.equal(x.rows[0].accuracyByte,255);
 assert.equal(x.rows[1].accuracyByte,216);
 assert.equal(x.rows[164].id,165);
});
test('detects a table in a later bank without fixed ROM offset',()=>{
 const x=findGen1MoveTable(romWithTable(BANK+100));
 assert.equal(x.valid,true);assert.equal(x.bank,1);
 assert.equal(x.rows[0].romFileOffset,BANK+100);
});
test('rejects ambiguous duplicate tables and missing tables',()=>{
 const a=romWithTable();const b=romWithTable(BANK+200);
 b.set(a.subarray(1000,1000+165*6),1000);
 assert.equal(findGen1MoveTable(b).valid,false);
 assert.equal(findGen1MoveTable(Buffer.alloc(BANK)).valid,false);
});
test('rejects invalid PP, wrong ID order and cross-bank tables',()=>{
 const a=romWithTable();a[1000+5]=99;
 assert.equal(findGen1MoveTable(a).valid,false);
 const b=romWithTable();b[1000+4*6]=88;
 assert.equal(findGen1MoveTable(b).valid,false);
 assert.equal(findGen1MoveTable(romWithTable(BANK-500)).valid,false);
});
test('rejects missing ROM or unsupported bank length',()=>{
 assert.equal(findGen1MoveTable(null).valid,false);
 assert.equal(findGen1MoveTable(Buffer.alloc(BANK+1)).valid,false);
});
